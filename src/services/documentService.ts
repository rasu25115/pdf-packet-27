import type { Document, DocumentType, ProductType } from '@/types'

class DocumentService {
  private documents: Map<string, Document> = new Map()
  private nextId = 1

  constructor() {
    this.loadFromLocalStorage()
  }

  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('documents')
      if (stored) {
        const docs: Document[] = JSON.parse(stored)
        docs.forEach(doc => {
          this.documents.set(doc.id, doc)
        })
      }
    } catch (error) {
      console.error('Error loading documents from storage:', error)
    }
  }

  private saveToLocalStorage() {
    try {
      const docs = Array.from(this.documents.values())
      localStorage.setItem('documents', JSON.stringify(docs))
    } catch (error) {
      console.error('Error saving documents to storage:', error)
    }
  }

  async getAllDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort((a, b) =>
      new Date(b.filename).getTime() - new Date(a.filename).getTime()
    )
  }

  async getDocumentsByProductType(productType: ProductType): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.productType === productType)
      .sort((a, b) =>
        new Date(b.filename).getTime() - new Date(a.filename).getTime()
      )
  }

  async getDocument(id: string): Promise<Document | null> {
    return this.documents.get(id) || null
  }

  private async validatePDF(file: File): Promise<{ valid: boolean; error?: string }> {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'File must be a PDF document' }
    }

    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'File size exceeds 50MB limit' }
    }

    if (file.size < 1024) {
      return { valid: false, error: 'File is too small to be a valid PDF' }
    }

    try {
      const arrayBuffer = await file.slice(0, 5).arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const signature = String.fromCharCode(...bytes)

      if (!signature.startsWith('%PDF')) {
        return { valid: false, error: 'File does not appear to be a valid PDF' }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: 'Failed to read file' }
    }
  }

  async uploadDocument(
    file: File,
    productType: ProductType,
    onProgress?: (progress: number) => void
  ): Promise<Document> {
    const validation = await this.validatePDF(file)
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid PDF file')
    }

    try {
      if (onProgress) onProgress(25)

      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          const base64Data = base64.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      if (onProgress) onProgress(50)

      const type = this.detectDocumentType(file.name)
      const name = this.extractDocumentName(file.name, type)

      const doc: Document = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description: `${type} Document`,
        filename: file.name,
        url: `data:application/pdf;base64,${fileData}`,
        size: file.size,
        type,
        required: false,
        products: [],
        productType
      }

      this.documents.set(doc.id, doc)
      this.saveToLocalStorage()

      if (onProgress) onProgress(100)

      return doc
    } catch (error) {
      console.error('Error in uploadDocument:', error)
      throw error instanceof Error ? error : new Error('Failed to upload document')
    }
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    const existing = this.documents.get(id)
    if (!existing) {
      throw new Error('Document not found')
    }

    const updated: Document = {
      ...existing,
      ...updates,
      id: existing.id,
      productType: existing.productType,
      url: existing.url
    }

    this.documents.set(id, updated)
    this.saveToLocalStorage()
  }

  async deleteDocument(id: string): Promise<void> {
    if (!this.documents.has(id)) {
      throw new Error('Document not found')
    }

    this.documents.delete(id)
    this.saveToLocalStorage()
  }

  async exportDocumentAsBase64(id: string): Promise<string | null> {
    const doc = this.documents.get(id)
    if (!doc || !doc.url) return null

    try {
      if (doc.url.startsWith('data:')) {
        return doc.url.split(',')[1]
      }

      const response = await fetch(doc.url)
      const blob = await response.blob()

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          const base64Data = base64.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error exporting document:', error)
      return null
    }
  }

  async getAllDocumentsWithData(): Promise<Array<Document & { fileData: string }>> {
    const documents = Array.from(this.documents.values())
    const results = []

    for (const doc of documents) {
      const fileData = await this.exportDocumentAsBase64(doc.id)
      if (fileData) {
        results.push({ ...doc, fileData })
      }
    }

    return results
  }

  private detectDocumentType(filename: string): DocumentType {
    const lower = filename.toLowerCase()

    if (lower.includes('tds') || lower.includes('technical data')) return 'TDS'
    if (lower.includes('esr') || lower.includes('evaluation report')) return 'ESR'
    if (lower.includes('msds') || lower.includes('safety data')) return 'MSDS'
    if (lower.includes('leed')) return 'LEED'
    if (lower.includes('installation') || lower.includes('install')) return 'Installation'
    if (lower.includes('warranty')) return 'warranty'
    if (lower.includes('acoustic') || lower.includes('esl')) return 'Acoustic'
    if (lower.includes('spec') || lower.includes('3-part')) return 'PartSpec'

    return 'TDS'
  }

  private extractDocumentName(filename: string, type: DocumentType): string {
    let name = filename.replace(/\.pdf$/i, '')

    const typeMap: Record<DocumentType, string> = {
      TDS: 'Technical Data Sheet',
      ESR: 'Evaluation Report',
      MSDS: 'Material Safety Data Sheet',
      LEED: 'LEED Credit Guide',
      Installation: 'Installation Guide',
      warranty: 'Limited Warranty',
      Acoustic: 'Acoustical Performance',
      PartSpec: '3-Part Specifications',
    }

    return typeMap[type] || name
  }
}

export const documentService = new DocumentService()
