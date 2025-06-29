describe("Sanity Test", () => {
	test("should pass basic assertion", () => {
		expect(1 + 1).toBe(2);
	});

	test("should verify Jest is working", () => {
		const message = "Hello, MCP Server Framework!";
		expect(message).toContain("MCP");
		expect(message).toHaveLength(28);
	});
});
