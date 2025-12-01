// pages/login.page.ts
import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
    // Propriedades da classe
    readonly page: Page;
    readonly usernameInput: Locator;
    readonly passwordInput: Locator;
    readonly signInButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.usernameInput = page.getByRole('textbox', { name: 'User name' });
        this.passwordInput = page.getByRole('textbox', { name: 'Password' });
        this.signInButton = page.getByRole('button', { name: 'Sign in' });
    }

    // Métodos de ação
    async goto() {
        await this.page.goto('https://crm.purifikar.com.br/index.php');
    }

    async login(username: string, password: string) {
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.signInButton.click();
    }
}