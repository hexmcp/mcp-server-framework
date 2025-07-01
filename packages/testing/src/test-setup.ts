declare global {
  function fail(message?: string): never;
}

global.fail = (message?: string): never => {
  throw new Error(message || 'Test failed');
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
