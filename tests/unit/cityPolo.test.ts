import assert from 'assert';

function parseUserFromName(userFromName: string) {
    const parts = userFromName.split('/');
    if (parts.length < 2) {
        throw new Error(`Invalid userFromName format: ${userFromName}`);
    }
    const assignedUser = parts[0].trim();
    const cityPolo = parts[1].trim();
    return { assignedUser, cityPolo };
}

try {
    const input = "Carlos Rodrigo dos Santos B. Teodoro - PSA / Pouso Alegre - MG";
    const expectedUser = "Carlos Rodrigo dos Santos B. Teodoro - PSA";
    const expectedCityPolo = "Pouso Alegre - MG";

    const result = parseUserFromName(input);

    assert.strictEqual(result.assignedUser, expectedUser);
    assert.strictEqual(result.cityPolo, expectedCityPolo);
    console.log(`✅ Test Passed: '${input}' -> User: '${result.assignedUser}', CityPolo: '${result.cityPolo}'`);

    const input2 = "Another Name / Sao Paulo - SP";
    const expectedUser2 = "Another Name";
    const expectedCityPolo2 = "Sao Paulo - SP";

    const result2 = parseUserFromName(input2);
    assert.strictEqual(result2.assignedUser, expectedUser2);
    assert.strictEqual(result2.cityPolo, expectedCityPolo2);
    console.log(`✅ Test Passed: '${input2}' -> User: '${result2.assignedUser}', CityPolo: '${result2.cityPolo}'`);

} catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
}
