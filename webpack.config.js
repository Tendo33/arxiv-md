const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const { ThirdPartyNoticesPlugin } = require("./scripts/third-party-notices");

// AR-09：background.js 是扩展后台脚本，从本地包加载，不走网络，webpack 默认 244 KiB 的
// "web performance" 告警对它没有意义（主要是 HTML→Markdown 转换 + PDF 解析内核）。
// 只把这一个已知大包移出默认检查，其余入口仍按默认 244 KiB 告警；
// background.js 另设 500 KiB 预算，超出照样告警，防止它悄悄继续变大。
const BACKGROUND_BUDGET = 500 * 1024;
class BackgroundBudgetPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("BackgroundBudgetPlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: "BackgroundBudgetPlugin", stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
        (assets) => {
          const a = assets["background.js"];
          if (a && a.size() > BACKGROUND_BUDGET) {
            compilation.warnings.push(new webpack.WebpackError(
              `background.js (${Math.round(a.size() / 1024)} KiB) exceeds its ${BACKGROUND_BUDGET / 1024} KiB budget (AR-09)`));
          }
        });
    });
  }
}

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
    // AR-06：不再生成 *.js.LICENSE.txt，许可证统一进 THIRD_PARTY_NOTICES.txt
    minimizer: [new TerserPlugin({ extractComments: false })],
  },
  performance: {
    hints: "warning",
    // AR-09：只排除 background.js（另有 BackgroundBudgetPlugin 预算），其余 .js 和 .css 仍受默认 244 KiB 限制
    // （rp2b：CSS 恢复计入，与 webpack 默认 assetFilter 一致）
    assetFilter: (f) => /\.(js|css)$/.test(f) && f !== "background.js",
  },
  plugins: [
    new BackgroundBudgetPlugin(),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(argv.mode || "development"),
    }),
    new CopyPlugin({
      patterns: [
        { from: "src/manifest.json", to: "manifest.json" },
        { from: "src/_locales", to: "_locales" },
        { from: "src/ui/popup/popup.html", to: "popup.html" },
        { from: "src/ui/popup/popup.css", to: "popup.css" },
        { from: "src/ui/settings/settings.html", to: "settings.html" },
        { from: "src/ui/settings/settings.css", to: "settings.css" },
        { from: "src/ui/shared/ui-v2.css", to: "ui-v2.css" },
        // R3 perf：只拷扩展实际用到的资源，README 截图（paper-page.png / popup.png）不进包；
        // AR-06：icon.svg（约 200KB）也不进包，设置页 logo 改用 icon-128.png
        { from: "assets/icon-*.png", to: "assets/[name][ext]" },
      ],
    }),
    new ThirdPartyNoticesPlugin(),
  ],
  resolve: {
    extensions: [".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@core": path.resolve(__dirname, "src/core"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@config": path.resolve(__dirname, "src/config"),
      "@background": path.resolve(__dirname, "src/background"),
      "@pdf-core": path.resolve(__dirname, "packages/pdf-parse-core/src"),
    },
    fallback: {
      // linkedom 的可选依赖，我们不需要 canvas
      canvas: false,
    },
  },
});
