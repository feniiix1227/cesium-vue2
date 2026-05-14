<template>
  <div class="map-box">
    <div id="cesiumContainer"></div>

    <div class="controls">
      <button
        type="button"
        class="gen-btn"
        @click="handleGenerate"
        :disabled="loading"
      >
        {{ loading ? "正在处理中..." : "生成卫星数据并存至服务器" }}
      </button>
      <div v-if="loading" class="loading-tag">正在同步轨道数据，请稍候...</div>
    </div>
  </div>
</template>

<script>
import * as Cesium from "cesium/Cesium";
import { convertTleToPureCzml } from "@/utils/TleToCzml.js";

export default {
  name: "CesiumMap",
  data() {
    return {
      viewer: null,
      loading: false,
    };
  },
  mounted() {
    this.initCesium();
  },
  methods: {
    initCesium() {
      // 填入你的 Token
      Cesium.Ion.defaultAccessToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YzUyY2Q4Ni1kMTk5LTQzYTEtYTdmZS1iZTU1YjE3MTFmZGEiLCJpZCI6Mzc2Mjk1LCJpYXQiOjE3Njc4NzM2NDh9.85JCYSb7nDmlTnzOughEP4_kTW3NEto5E_kgXIfkMRA";

      this.viewer = new Cesium.Viewer("cesiumContainer", {
        infoBox: false,
        animation: true,
        timeline: true,
        fullscreenButton: true,
        geocoder: true,
        baseLayerPicker: true,
        sceneModePicker: false,
        navigationHelpButton: false,
        homeButton: true,
        shouldAnimate: true, // 开启自动播放
      });
      // Cesium.GeoJsonDataSource.load("/chn.geojson").then((dataSource) => {
      //   this.viewer.dataSources.add(dataSource);
      // });

      this.viewer.scene.globe.depthTestAgainstTerrain = true;

      // 初始北京视角
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.39, 39.9, 15000000.0),
      });
    },

    async handleGenerate() {
      if (this.loading) return;
      // this.viewer.dataSources.removeAll();
      // 清除所有手动创建的实体（Entity）
      // this.viewer.entities.removeAll();
      this.loading = true;

      try {
        // 1. 准备 TLE 数据（这里包含你的 2 颗核心卫星，你可以根据需要扩展）
        const satArray = [
          {
            name: "SAT-052",
            line1:
              "1 70052U 23052A   24010.51860431  .00017122  00000-0  30616-3 0  9997",
            line2:
              "2 70052  53.0000 183.6000 0001443   0.0000 183.6000 15.49629535433748",
          },
          {
            name: "SAT-053",
            line1:
              "1 70053U 23053A   24010.51860431  .00017122  00000-0  30616-3 0  9997",
            line2:
              "2 70053  53.0000 187.2000 0001443   0.0000 187.2000 15.49629535433748",
          },

          {
            name: "SAT-071",
            line1:
              "1 70071U 23071A   24010.51860431  .00017122  00000-0  30616-3 0  9997",
            line2:
              "2 70071  53.0000 252.0000 0001443   0.0000 252.0000 15.49629535433748",
          },

          {
            name: "SAT-098",
            line1:
              "1 70098U 23098A   24010.51860431  .00017122  00000-0  30616-3 0  9997",
            line2:
              "2 70098  53.0000 349.2000 0001443   0.0000 349.2000 15.49629535433748",
          },
          {
            name: "SAT-099",
            line1:
              "1 70099U 23099A   24010.51860431  .00017122  00000-0  30616-3 0  9997",
            line2:
              "2 70099  53.0000 352.8000 0001443   0.0000 352.8000 15.49629535433748",
          },
          {
            name: "SAT-100",
            line1:
              "1 70100U 23100A   24010.51860431  .00017122  00000-0  30616-3 0  9997",
            line2:
              "2 70100  53.0000 356.4000 0001443   0.0000 356.4000 15.49629535433748",
          },
        ];

        // 2. 转换为 CZML 数据
        const czmlData = convertTleToPureCzml(satArray, {
          durationHours: 24,
          stepMinutes: 10,
        });

        // 3. 发送至后端并【等待】写入完成
        console.log("正在保存轨道文件...");
        const response = await fetch("/api/save-czml", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(czmlData),
        });

        if (!response.ok) throw new Error("后端保存失败");

        // 确保解析了 response 内容，确保后端已经 close 文件流
        await response.text();
        console.log("服务器保存成功");

        // 4. 清理旧数据并重新加载
        // this.viewer.dataSources.removeAll();

        // 🔴 关键：添加时间戳查询参数，强制浏览器绕过磁盘缓存读取最新文件
        const url = `/data/sat_data.czml?t=${new Date().getTime()}`;

        console.log("正在从磁盘读取最新 CZML...");
        const dataSource = await Cesium.CzmlDataSource.load(url);

        // 将新数据添加到场景
        await this.viewer.dataSources.add(dataSource);

        // 5. 视角对焦到卫星，不再停留在北京
        // this.viewer.zoomTo(dataSource);

        // alert("成功：卫星轨道已更新并重新定位！");
      } catch (error) {
        console.error("生成流程中断:", error);
        alert("错误: " + error.message);
      } finally {
        this.loading = false;
      }
    },

    beforeDestroy() {
      if (this.viewer) {
        this.viewer.destroy();
      }
    },
  },
};
</script>

<style scoped>
.map-box {
  position: relative;
  width: 100%;
  height: 100vh;
}
#cesiumContainer {
  width: 100%;
  height: 100%;
}

.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gen-btn {
  padding: 12px 20px;
  background: rgba(0, 80, 80, 0.9);
  color: #00f0f0;
  border: 1px solid #00f0f0;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s ease;
}

.gen-btn:hover {
  background: rgba(0, 150, 150, 0.9);
  box-shadow: 0 0 15px #00f0f0;
}

.gen-btn:disabled {
  background: #333;
  color: #666;
  border-color: #444;
  cursor: not-allowed;
}

.loading-tag {
  color: #00f0f0;
  background: rgba(0, 0, 0, 0.7);
  padding: 8px;
  font-size: 13px;
  border-left: 3px solid #00f0f0;
}
</style>
