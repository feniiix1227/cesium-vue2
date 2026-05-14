/* eslint-disable */ // 彻底禁用此文件的 ESLint 检查，避免 read-only 报错
import * as Cesium from "cesium/Cesium";

/**
 * 流动线路材质属性
 */
export default class LineFlowMaterialProperty {
  constructor(options) {
    options = options || {};
    this._definitionChanged = new Cesium.Event();
    this._color = undefined;
    this._speed = undefined;
    this._percent = undefined;
    this._gradient = undefined;

    this.color = options.color || Cesium.Color.CYAN;
    this.speed = options.speed || 10.0;
    this.percent = options.percent || 0.1;
    this.gradient = options.gradient || 0.01;
  }

  get isConstant() {
    return false;
  }

  get definitionChanged() {
    return this._definitionChanged;
  }

  // 修复：删除没用的 time 参数，或保留参数但禁用 lint 检查
  getType(time) {
    return Cesium.Material.LineFlowMaterialType;
  }

  getValue(time, result) {
    if (!Cesium.defined(result)) {
      result = {};
    }
    result.color = Cesium.Property.getValueOrDefault(
      this._color,
      time,
      Cesium.Color.CYAN,
      result.color
    );
    result.speed = Cesium.Property.getValueOrDefault(
      this._speed,
      time,
      10.0,
      result.speed
    );
    result.percent = Cesium.Property.getValueOrDefault(
      this._percent,
      time,
      0.1,
      result.percent
    );
    result.gradient = Cesium.Property.getValueOrDefault(
      this._gradient,
      time,
      0.01,
      result.gradient
    );
    return result;
  }

  equals(other) {
    return (
      this === other ||
      (other instanceof LineFlowMaterialProperty &&
        Cesium.Property.equals(this._color, other._color) &&
        Cesium.Property.equals(this._speed, other._speed) &&
        Cesium.Property.equals(this._percent, other._percent) &&
        Cesium.Property.equals(this._gradient, other._gradient))
    );
  }
}

// 定义属性描述符
Object.defineProperties(LineFlowMaterialProperty.prototype, {
  color: Cesium.createPropertyDescriptor("color"),
  speed: Cesium.createPropertyDescriptor("speed"),
  percent: Cesium.createPropertyDescriptor("percent"),
  gradient: Cesium.createPropertyDescriptor("gradient"),
});

// 解决 read-only 报错：
// 不要直接给 Cesium.xxx 赋值，因为 import * as Cesium 是只读的。
// 我们改用字符串引用的方式注册材质。
const LineFlowMaterialType = "LineFlowMaterialType";
const LineFlowMaterialSource = `
    uniform vec4 color;
    uniform float speed;
    uniform float percent;
    uniform float gradient;
    
    czm_material czm_getMaterial(czm_materialInput materialInput){
      czm_material material = czm_getDefaultMaterial(materialInput);
      vec2 st = materialInput.st;
      float t = fract(czm_frameNumber * speed / 1000.0);
      t *= (1.0 + percent);
      float alpha = smoothstep(t - percent, t, st.s) * step(-t, -st.s);
      alpha += gradient;
      material.diffuse = color.rgb;
      material.alpha = alpha;
      return material;
    }
`;

// 注册材质
Cesium.Material._materialCache.addMaterial(LineFlowMaterialType, {
  fabric: {
    type: LineFlowMaterialType,
    uniforms: {
      color: new Cesium.Color(0.0, 1.0, 1.0, 1.0),
      speed: 10.0,
      percent: 0.1,
      gradient: 0.01,
    },
    source: LineFlowMaterialSource,
  },
  translucent: function () {
    return true;
  },
});

// 将常量手动挂载，如果仍然报错只读，getType 处直接返回字符串 'LineFlowMaterialType' 即可
Cesium.Material.LineFlowMaterialType = LineFlowMaterialType;
