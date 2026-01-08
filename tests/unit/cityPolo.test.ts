/**
 * Testes de parsing do userFromName para City Polo
 */

/**
 * Parseia o campo userFromName da Auvo para extrair usuário e cidade polo
 * Formato esperado: "Nome do Usuário - Sigla / Cidade - UF"
 * Exemplo: "Carlos Rodrigo dos Santos B. Teodoro - PSA / Pouso Alegre - MG"
 */
function parseUserFromName(userFromName: string): { assignedUser: string; cityPolo: string } {
    const parts = userFromName.split('/');
    if (parts.length < 2) {
        throw new Error(`Invalid userFromName format: ${userFromName}`);
    }
    const assignedUser = parts[0].trim();
    const cityPolo = parts[1].trim();
    return { assignedUser, cityPolo };
}

describe('City Polo Parser', () => {

    describe('parseUserFromName', () => {
        test('deve parsear formato completo corretamente', () => {
            const input = 'Carlos Rodrigo dos Santos B. Teodoro - PSA / Pouso Alegre - MG';
            const result = parseUserFromName(input);

            expect(result.assignedUser).toBe('Carlos Rodrigo dos Santos B. Teodoro - PSA');
            expect(result.cityPolo).toBe('Pouso Alegre - MG');
        });

        test('deve parsear formato simples', () => {
            const input = 'Another Name / Sao Paulo - SP';
            const result = parseUserFromName(input);

            expect(result.assignedUser).toBe('Another Name');
            expect(result.cityPolo).toBe('Sao Paulo - SP');
        });

        test('deve parsear Leonardo Alves', () => {
            const input = 'Leonardo Alves Feitosa - IIG / Ipatinga - MG';
            const result = parseUserFromName(input);

            expect(result.assignedUser).toBe('Leonardo Alves Feitosa - IIG');
            expect(result.cityPolo).toBe('Ipatinga - MG');
        });

        test('deve lançar erro para formato inválido', () => {
            const input = 'Nome sem barra';

            expect(() => parseUserFromName(input)).toThrow('Invalid userFromName format');
        });

        test('deve lidar com espaços extras', () => {
            const input = '  Nome do Usuario  /  Cidade - UF  ';
            const result = parseUserFromName(input);

            expect(result.assignedUser).toBe('Nome do Usuario');
            expect(result.cityPolo).toBe('Cidade - UF');
        });
    });
});
