global.fail = (message?: string) => {
  throw new Error(message || 'Test failed');
};
