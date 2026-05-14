<template>
  <div class="map-box">
    <div id="cesiumContainer"></div>

    <aside class="left-panel">
      <div class="panel-header">
        <div class="header-main">
          <label class="cyber-checkbox mini">
            <input
              type="checkbox"
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="toggleAllSatellites"
            />
            <span class="checkmark"></span>
          </label>
          <div class="header-title">轨道资产监控</div>
        </div>
        <div class="sat-count">{{ satList.length }}</div>
      </div>

      <div class="panel-body custom-scrollbar">
        <div v-if="satList.length === 0" class="empty-state">
          <div class="empty-icon">📡</div>
          <p>请点击初始化获取数据</p>
        </div>

        <div
          v-for="(sat, index) in satList"
          :key="index"
          class="sat-card"
          :class="{ 'card-active': sat.checked }"
          @click="flyToSatellite(sat.name)"
        >
          <div class="checkbox-container" @click.stop>
            <label class="cyber-checkbox">
              <input
                type="checkbox"
                v-model="sat.checked"
                @change="syncEntityVisibility(sat)"
              />
              <span class="checkmark"></span>
            </label>
          </div>

          <div class="sat-info">
            <div class="sat-main-text">
              <div class="sat-name">{{ sat.name }}</div>
              <div class="sat-meta">
                <span class="orbit-tag" :class="sat.orbitClass">{{
                  sat.orbitLabel
                }}</span>
                <span class="orbit-status">{{
                  sat.checked ? "侦照中" : "运行中"
                }}</span>
              </div>
            </div>
            <div class="sat-badge" :class="{ 'badge-active': sat.checked }">
              {{ sat.checked ? "显示" : "隐藏" }}
            </div>
          </div>
        </div>
      </div>

      <div class="panel-footer" v-if="satList.length > 0">
        已选择: {{ selectedCount }} / {{ satList.length }}
      </div>
    </aside>

    <div class="top-controls">
      <button
        type="button"
        class="main-gen-btn"
        @click="handleGenerate"
        :disabled="loading"
      >
        <span v-if="loading" class="loading-spinner"></span>
        {{ loading ? "数据同步中..." : "一键初始化卫星数据" }}
      </button>
    </div>

    <transition name="pop">
      <div
        v-if="showDialog"
        class="floating-dialog"
        :style="{ left: dialogPos.x + 'px', top: dialogPos.y + 'px' }"
      >
        <div class="dialog-header">
          <span class="dialog-title">指令终端 / COMMAND</span>
          <button class="close-x" @click="showDialog = false">×</button>
        </div>

        <div class="dialog-content">
          <div class="target-display">
            <div class="display-label">当前目标</div>
            <div class="display-value">{{ selectedSatName }}</div>
          </div>

          <div class="control-row">
            <span class="control-label">覆盖范围显示</span>
            <div
              class="ios-switch"
              :class="{ active: isRangeVisible }"
              @click="toggleSatelliteRange"
            >
              <div class="switch-handle"></div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import * as Cesium from "cesium/Cesium";
import { convertTleToPureCzml } from "@/utils/TleToCzml.js";

export default {
  name: "CesiumMap",
  data() {
    return {
      viewer: null, // Cesium Viewer 实例
      loading: false, // 初始化接口加载状态
      satList: [], // 卫星业务数据列表
      showDialog: false, // 指令终端显隐
      dialogPos: { x: 0, y: 0 }, // 指令终端在屏幕上的像素坐标
      selectedEntity: null, // 当前在 3D 场景中被选中的 Entity 对象
      selectedSatName: "", // 被选中卫星的名称
    };
  },
  computed: {
    // 统计已勾选的卫星数量
    selectedCount() {
      return this.satList.filter((s) => s.checked).length;
    },
    // 是否全部选中
    isAllSelected() {
      return (
        this.satList.length > 0 && this.selectedCount === this.satList.length
      );
    },
    // 是否处于半选状态
    isIndeterminate() {
      return this.selectedCount > 0 && this.selectedCount < this.satList.length;
    },
    // 获取当前选中的 Entity 的范围圈(Ellipse)是否正在显示
    isRangeVisible() {
      if (!this.selectedEntity || !this.selectedEntity.ellipse) return false;
      return this.selectedEntity.ellipse.show.getValue();
    },
  },
  mounted() {
    this.initCesium();
  },
  methods: {
    /**
     * 初始化 Cesium Viewer 并绑定交互事件
     */
    initCesium() {
      // 填入你的 Cesium Ion Access Token
      Cesium.Ion.defaultAccessToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YzUyY2Q4Ni1kMTk5LTQzYTEtYTdmZS1iZTU1YjE3MTFmZGEiLCJpZCI6Mzc2Mjk1LCJpYXQiOjE3Njc4NzM2NDh9.85JCYSb7nDmlTnzOughEP4_kTW3NEto5E_kgXIfkMRA";

      this.viewer = new Cesium.Viewer("cesiumContainer", {
        infoBox: false, // 禁用默认的信息框
        selectionIndicator: false, // 禁用默认的选择框
        shouldAnimate: true, // 允许动画（用于卫星移动）
        baseLayerPicker: false, // 禁用底图选择器
      });

      // 初始化屏幕空间事件处理器
      const handler = new Cesium.ScreenSpaceEventHandler(
        this.viewer.scene.canvas
      );
      // 注册右键点击事件：执行对象拾取（Pick）
      handler.setInputAction((movement) => {
        const picked = this.viewer.scene.pick(movement.position);
        if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
          this.selectedEntity = picked.id;
          this.selectedSatName = picked.id.name;
          // 确保实体拥有 Ellipse 图形，否则右键操作无效
          this.ensureEllipseCreated(this.selectedEntity);
          this.dialogPos = {
            x: movement.position.x + 15, // 偏移显示
            y: movement.position.y + 15,
          };
          this.showDialog = true;
        } else {
          this.showDialog = false; // 点击空白处关闭
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    },

    /**
     * 全选/取消全选：同步所有卫星的显隐
     */
    toggleAllSatellites(event) {
      const checked = event.target.checked;
      this.satList.forEach((sat) => {
        sat.checked = checked;
        this.syncEntityVisibility(sat);
      });
    },

    /**
     * 将业务列表的状态同步到 Cesium Entity
     */
    syncEntityVisibility(sat) {
      if (!this.viewer.dataSources.length) return;
      const dataSource = this.viewer.dataSources.get(0);
      // 在数据源中查找对应名称的实体
      const entity = dataSource.entities.values.find(
        (e) => e.name === sat.name
      );
      if (entity) {
        this.ensureEllipseCreated(entity);
        // 使用 ConstantProperty 设置显隐状态
        entity.ellipse.show = new Cesium.ConstantProperty(sat.checked);
      }
    },

    /**
     * 锁定并追踪指定卫星
     */
    flyToSatellite(name) {
      const dataSource = this.viewer.dataSources.get(0);
      if (!dataSource) return;
      const target = dataSource.entities.values.find((e) => e.name === name);
      // 设置 trackedEntity 后，相机将跟随卫星移动
      if (target) this.viewer.trackedEntity = target;
    },

    /**
     * 生成卫星数据：TLE 转 CZML 并保存、加载
     */
    async handleGenerate() {
      if (this.loading) return;
      this.loading = true;

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

      try {
        // 将 TLE 两线数转换为 CZML 轨迹格式
        const czmlData = convertTleToPureCzml(satArray, {
          durationHours: 24,
          stepMinutes: 10,
        });

        // 调用接口将生成的 CZML 发送至服务器保存
        const response = await fetch("/api/save-czml", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(czmlData),
        });

        if (response.ok) {
          // 重新加载 CZML 数据源，附带时间戳刷新缓存
          const url = `/data/sat_data.czml?t=${new Date().getTime()}`;
          const dataSource = await Cesium.CzmlDataSource.load(url);
          this.viewer.dataSources.removeAll();
          await this.viewer.dataSources.add(dataSource);

          // 更新本地列表，设置轨道分类
          this.satList = satArray.map((s, index) => {
            const isHigh = index > 3;
            return {
              ...s,
              checked: false,
              orbitLabel: isHigh ? "高轨" : "低轨",
              orbitClass: isHigh ? "orbit-high" : "orbit-low",
            };
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },

    /**
     * 为 Entity 添加覆盖范围圈（Ellipse）
     * 如果已存在则跳过，否则初始化图形参数
     */
    ensureEllipseCreated(entity) {
      if (entity.ellipse) return;
      entity.ellipse = new Cesium.EllipseGraphics({
        show: new Cesium.ConstantProperty(false),
        // 半长轴与半短轴设为 450km (示例范围)
        semiMajorAxis: new Cesium.CallbackProperty(() => 450000, false),
        semiMinorAxis: new Cesium.CallbackProperty(() => 450000, false),
        material: Cesium.Color.CYAN.withAlpha(0.15),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
        outlineWidth: 1.0,
      });
    },

    /**
     * 指令终端：切换单个卫星的侦照范围显隐
     */
    toggleSatelliteRange() {
      const current = this.selectedEntity.ellipse.show.getValue();
      const newState = !current;
      // 更新 3D 场景
      this.selectedEntity.ellipse.show = new Cesium.ConstantProperty(newState);
      // 同步更新左侧列表 UI 状态
      const targetSat = this.satList.find(
        (s) => s.name === this.selectedSatName
      );
      if (targetSat) targetSat.checked = newState;
    },
  },
};
</script>

<style scoped>
/* 样式部分保持不变 */
.map-box {
  position: relative;
  width: 100%;
  height: 100vh;
  background-color: #000;
  color: #fff;
  font-family: "Segoe UI", sans-serif;
}
#cesiumContainer {
  width: 100%;
  height: 100%;
}

/* --- 面板样式 --- */
.left-panel {
  position: absolute;
  left: 20px;
  top: 85px;
  width: 300px;
  max-height: 80vh;
  background: rgba(13, 22, 31, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 240, 240, 0.3);
  border-radius: 8px;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 240, 240, 0.2);
}
.header-main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-title {
  font-size: 14px;
  font-weight: bold;
  color: #00f0f0;
}
.sat-count {
  font-family: monospace;
  background: rgba(0, 240, 240, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  color: #00f0f0;
  font-size: 12px;
}
.panel-body {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.sat-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}
.sat-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(0, 240, 240, 0.4);
}
.card-active {
  border-color: #00f0f0 !important;
  background: rgba(0, 240, 240, 0.05) !important;
}

.checkbox-container {
  margin-right: 12px;
}
.cyber-checkbox {
  position: relative;
  width: 18px;
  height: 18px;
  cursor: pointer;
  display: block;
}
.cyber-checkbox input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 240, 240, 0.4);
  border-radius: 3px;
}
.cyber-checkbox input:checked + .checkmark {
  background: #00f0f0;
}
.cyber-checkbox input:indeterminate + .checkmark {
  background: rgba(0, 240, 240, 0.4);
}
.checkmark:after {
  content: "";
  position: absolute;
  display: none;
  left: 6px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid #000;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.cyber-checkbox input:checked + .checkmark:after {
  display: block;
}

.sat-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sat-name {
  font-size: 13px;
  font-weight: bold;
}
.sat-meta {
  margin-top: 4px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.orbit-tag {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
}
.orbit-low {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
  border: 1px solid #4facfe;
}
.orbit-high {
  background: rgba(240, 147, 251, 0.2);
  color: #f093fb;
  border: 1px solid #f093fb;
}
.orbit-status {
  font-size: 10px;
  color: #666;
}
.sat-badge {
  font-size: 9px;
  padding: 2px 4px;
  border: 1px solid #444;
  color: #666;
  border-radius: 2px;
}
.badge-active {
  border-color: #00f0f0;
  color: #00f0f0;
}
.panel-footer {
  padding: 10px;
  text-align: center;
  font-size: 11px;
  color: #555;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.top-controls {
  position: absolute;
  top: 24px;
  left: 20px;
  z-index: 101;
}
.main-gen-btn {
  background: rgba(0, 240, 240, 0.1);
  border: 1px solid #00f0f0;
  color: #00f0f0;
  padding: 10px 24px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

/* --- 指令终端样式 --- */
.floating-dialog {
  position: absolute;
  width: 220px;
  background: rgba(18, 25, 33, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border-radius: 10px;
  z-index: 1000;
  overflow: hidden;
}

.dialog-header {
  padding: 10px 15px;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.dialog-title {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  letter-spacing: 0.5px;
}

.close-x {
  background: none;
  border: none;
  color: #666;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}
.close-x:hover {
  color: #fff;
}

.dialog-content {
  padding: 15px;
}

.target-display {
  margin-bottom: 15px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.display-label {
  font-size: 10px;
  color: #555;
  margin-bottom: 4px;
}
.display-value {
  font-size: 16px;
  font-weight: bold;
  color: #00f0f0;
  font-family: monospace;
}

.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.control-label {
  font-size: 12px;
  color: #ccc;
}

.ios-switch {
  width: 36px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s ease;
}
.ios-switch.active {
  background: #00f0f0;
}
.switch-handle {
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.ios-switch.active .switch-handle {
  transform: translateX(16px);
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 240, 240, 0.3);
  border-radius: 2px;
}
</style>
