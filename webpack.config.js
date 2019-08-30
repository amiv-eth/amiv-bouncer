const publicPath = '/dist/';

const config = {
  context: `${__dirname}/src`, // `__dirname` is root of project

  entry: './index.js',

  output: {
    path: `${__dirname}/dist`, // `dist` is the destination
    filename: 'bundle.js',
  },

  // To run development server
  devServer: {
    contentBase: __dirname,
    publicPath,
    compress: true,
    port: 9000,
    hot: true,
    index: 'index.html',
  },

  module: {
    rules: [
      {
        test: /\.js$/, // Check for all js files
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { useBuiltIns: 'usage', corejs: 3, targets: 'last 2 years' }],
              ],
            },
          },
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              // useRelativePath: true,
              publicPath,
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],

  },

  resolve: {
    alias: {
      config: `${__dirname}/config.js`,
    },
  },

  /*
  // Replace Polythene Theme
  // https://github.com/ArthurClemens/polythene/blob/master/docs/theming/global-theme-file.md
  resolve: {
    alias: {
      'polythene-theme': `${__dirname}/src/polythene-theme.js`,
    },
  },
  */

  devtool: 'eval-source-map', // Default development sourcemap

  optimization: {
    usedExports: true,
    sideEffects: false,
  },
};

module.exports = config;
