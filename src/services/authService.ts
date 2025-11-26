export class AuthService {
  private isAuth = false

  async signInAdmin(email: string, password: string) {
    try {
      if (password === 'admin123') {
        this.isAuth = true
        return { user: { id: '1', email: email || 'admin@example.com' } }
      }
      throw new Error('Invalid login credentials')
    } catch (err) {
      if (err instanceof Error) {
        throw err
      }
      throw new Error('Authentication failed')
    }
  }

  async signOut() {
    try {
      this.isAuth = false
    } catch (err) {
      console.error('Sign out error:', err)
      throw err
    }
  }

  async getUser() {
    if (this.isAuth) {
      return { id: '1', email: 'admin@example.com' }
    }
    return null
  }

  async isAuthenticated(): Promise<boolean> {
    return this.isAuth
  }

  onAuthStateChange(callback: (isAuthenticated: boolean) => void) {
    const checkAuth = () => {
      callback(this.isAuth)
    }

    return () => {
      // unsubscribe
    }
  }
}

export const authService = new AuthService()
