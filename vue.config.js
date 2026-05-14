const { defineConfig } = require("@vue/cli-service");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");

const cesiumSource = "node_modules/cesium/Source";

module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    output: {
      sourcePrefix: " ",
    },
    amd: {
      toUrlUndefined: true,
    },
    resolve: {
      alias: {
        cesium: path.resolve(__dirname, cesiumSource),
      },
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(cesiumSource, "../Build/Cesium/Workers"),
            to: "Workers",
          },
          { from: path.join(cesiumSource, "Assets"), to: "Assets" },
          { from: path.join(cesiumSource, "Widgets"), to: "Widgets" },
          { from: path.join(cesiumSource, "ThirdParty"), to: "ThirdParty" },
        ],
      }),
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify("./"),
      }),
    ],
  },
  devServer: {
    // 🔴 关键点 1：禁止监听 public/data 文件夹
    // 这样后端写入 CZML 文件时，浏览器才不会自动刷新
    watchFiles: {
      paths: ["src/**/*", "public/**/*"],
      options: {
        ignored: [/public\/data/],
      },
    },
    static: {
      watch: {
        // 🔴 关键：彻底忽略 public/data 文件夹，让它写文件时不触发刷新
        ignored: /public\/data/,
      },
    },
    onBeforeSetupMiddleware: function (devServer) {
      const app = devServer.app;
      // 🔴 关键点 2：设置足够大的 limit 以处理大量卫星数据
      app.use(bodyParser.json({ limit: "100mb" }));

      app.post("/api/save-czml", (req, res) => {
        try {
          const czmlData = req.body;
          // 定义写入路径
          const targetPath = path.join(__dirname, "public/data/sat_data.czml");

          // 确保目录存在
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // 🔴 关键点 3：同步写入文件，确保写完再回响应
          fs.writeFileSync(targetPath, JSON.stringify(czmlData, null, 2));

          console.log("✅ 成功写入文件至:", targetPath);

          // 返回标准 JSON 格式，前端 await fetch 才能正确接收
          res.json({
            status: "success",
            message: "文件已保存到服务器",
          });
        } catch (error) {
          console.error("❌ 写入文件失败:", error);
          res.status(500).json({
            status: "error",
            message: error.message,
          });
        }
      });
    },
  },
});
