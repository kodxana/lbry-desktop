module.exports = (api) => {
  api.cache(false);

  return {
    presets: [['@babel/env', { loose: true, modules: false }], '@babel/react', '@babel/flow'],
    plugins: [
      'import-glob',
      '@babel/plugin-transform-runtime',
      ['@babel/plugin-proposal-decorators', { decoratorsBeforeExport: true }],
      ['@babel/plugin-proposal-private-methods', { loose: false }],
      ['@babel/plugin-proposal-private-property-in-object', { loose: false }],
      '@babel/plugin-transform-flow-strip-types',
      '@babel/plugin-proposal-class-properties',
    ],
    overrides: [
      {
        test: ['./ui/**/*.js', './ui/**/*.jsx'],
        plugins: process.env.NODE_ENV === 'development' ? ['react-refresh/babel'] : [],
      },
    ],
    ignore: [/node_modules/],
  };
};

