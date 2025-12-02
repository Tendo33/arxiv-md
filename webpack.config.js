const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
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
  plugins: [
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
    },
    fallback: {
      // linkedom 的可选依赖，我们不需要 canvas
      canvas: false,
    },
  },
};
