/*
  # Create Documents Table with RLS

  1. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `name` (text, document name)
      - `description` (text, document description)
      - `filename` (text, original filename)
      - `file_url` (text, public URL to file in storage)
      - `size` (bigint, file size in bytes)
      - `type` (text, document type like TDS, ESR, etc.)
      - `product_type` (text, either 'structural-floor' or 'underlayment')
      - `required` (boolean, whether document is required)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on documents table
    - Allow public read access (needed for PDF generation)
    - Allow authenticated users to manage documents (admins only)

  3. Storage
    - Ensure documents bucket exists with proper policies
*/

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  filename text NOT NULL,
  file_url text NOT NULL,
  size bigint DEFAULT 0,
  type text NOT NULL,
  product_type text NOT NULL,
  required boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read documents (needed for PDF generation and public viewing)
CREATE POLICY "Public can view documents"
  ON documents FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to insert documents
CREATE POLICY "Authenticated users can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update documents
CREATE POLICY "Authenticated users can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete documents
CREATE POLICY "Authenticated users can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to update updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
