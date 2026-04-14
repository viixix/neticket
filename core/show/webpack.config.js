const path = require('node:path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = function (options) {
  const resolve = options.resolve || {};
  const moduleConfig = options.module || {};
  const rules = moduleConfig.rules || [];
  const plugins = resolve.plugins || [];

  return {
    ...options,
    resolve: {
      ...resolve,
      plugins: [
        ...plugins,
        new TsconfigPathsPlugin({
          configFile: path.resolve(__dirname, 'tsconfig.json'),
          extensions: resolve.extensions || ['.ts', '.js', '.json'],
        }),
      ],
    },
    module: {
      ...moduleConfig,
      rules: [
        ...rules,
        {
          test: /\.lua$/,
          type: 'asset/source',
        },
      ],
    },
  };
};
