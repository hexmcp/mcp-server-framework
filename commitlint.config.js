module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['cli', 'core', 'transport', 'codec-jsonrpc']],
    'scope-empty': [0, 'never'],
    'subject-case': [2, 'never', ['pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [0, 'always', 140],
    'type-empty': [2, 'never'],
    'type-enum': [2, 'always', ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test']],
    'header-max-length': [0, 'always', 140],
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [0, 'always', 140],
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [0, 'always', 140],
  },
};
