module.exports = {
  extends: 'airbnb-base',
  env: {
    'browser': true,
    'node': true
  },
  rules: {
    // Adjust the rules to your needs.
    // Complete List: https://eslint.org/docs/rules/
    'no-underscore-dangle': 0,
  },
  settings: {
    'import/resolver': {
        webpack: {},
    },
  },
};
