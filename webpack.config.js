const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => ({
  entry: {
    background: "./src/background/index.js",
    content: "./src/content/index.js",
    popup: "./src/ui/popup/popup.js",
    settings: "./src/ui/settings/settings.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  optimization: {
    // 禁用 Webpack 自动注入 process.env.NODE_ENV，改由下方 DefinePlugin 显式控制
    nodeEnv: false,
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(argv.mode || "development"),
    }),
    new CopyPlugin({
      patterns: [
        { from: "src/manifest.json", to: "manifest.json" },
        { from: "src/ui/popup/popup.html", to: "popup.html" },
        { from: "src/ui/popup/popup.css", to: "popup.css" },
        { from: "src/ui/settings/settings.html", to: "settings.html" },
        { from: "src/ui/settings/settings.css", to: "settings.css" },
        { from: "assets", to: "assets" },
      ],
    }),
  ],
  resolve: {
    extensions: [".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@core": path.resolve(__dirname, "src/core"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@config": path.resolve(__dirname, "src/config"),
      "@background": path.resolve(__dirname, "src/background"),
    },
    fallback: {
      // linkedom 的可选依赖，我们不需要 canvas
      canvas: false,
    },
  },
});
