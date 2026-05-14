import * as satellite from "satellite.js";

/**
 * 将 TLE (两线轨道根数) 数组转换为 Cesium 专用的 CZML 对象
 * @param {Array} tleArray - 包含 {name, line1, line2} 的对象数组
 * @param {Object} options - 配置项
 * @param {number} options.durationHours - 预测轨迹的持续时长（小时），默认 12 小时
 * @param {number} options.stepMinutes - 采样步长（分钟），默认 10 分钟一次采样
 */
export function convertTleToPureCzml(tleArray, options = {}) {
  // 解构配置参数，并设置默认值
  const { durationHours = 12, stepMinutes = 10 } = options;
  const startTime = new Date(); // 获取当前时间作为起始时间
  // 计算结束时间：起始时间 + 持续毫秒数
  const stopTime = new Date(startTime.getTime() + durationHours * 3600000);

  // 预设卫星图标 Base64 字符串数组，用于在地图上显示不同样式的图标
  const images = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAATVJREFUOE+lU1FOg0AQfbPLMfzgAiXa+i/ESygxAU5SOYixTQx6i2L8tdXQA8hBZNfMwiICxRr3Z5OZee/N7Jsl/PPQGP7t9MqVUiyrSqVn70/llMaAoAF/NKCyqlQwRTIgKBYhg92O6srbZsl+Hi45NttlabejAQEXasJtW6SRgHQEkG9iGom3y1Y2P/oGDUkMIAfA9/c5hsBWF4vrTatcy+fe9jGYHMEm9+c3vtZq01cH4aLrzrgLQviVUrmU4gXACSsDxHbacVp3fhD0VE2R4zju7PUhP+SOISjmYWwUhfC5RatEJAIGc03PnZJIJJwzBMZjIZ61VpH61HdS0iVb2SXokMQWzLGaoH6we2ik3AGRWJuladSPWuXWe42Ux/ntD4wuUtNJRBplf2UPdTG6iX/54V8KW6IRUj57xgAAAABJRU5ErkJggg==",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAWBJREFUOE+Nk01SAjEQhd/LeAB/DmCoUqo8hcNJkCV6CPQQylI4CXAKqmRhPIAUe4e01QkZZoI/ZDM/SX/z+vUbYrcunt/uxPDSo5puhjcuvf/vSj1wPl6N9EovH57sC6vBsRDmxSQdIO5YJTsArRYBtPR+oWqEGK3vux29Px0v7W+KGi3Qesi08GLFmFst1GcKRgRKT/Q2w+t57kkANH1QFSJitSioIicQPAYgq06upAY0Idq/kZN3AeYRtFvkZD28GjRVtABp4+xlNatraoA4z23vTwXRsFVpRF4FdPnX1ROgck3IgYIIQK0gKokTAtULNfvrKUEYCsB+OuiBhSoIBcE49HRfx6tJDThBmcJGnbGRYpYKQoiyXtWTFLC9gVFJaOEAkrmd0ho/ou00MOm2DRGXUtjOSUxqakXH3TJxDwFygILSHxtTioUm84cpLG3hi/LzoTvJY5sgW0OXYv0NlavRUORHSncAAAAASUVORK5CYII=",
  ];

  // 初始化 CZML 头部文档对象，定义时钟控制和渲染区间
  const czml = [
    {
      id: "document",
      version: "1.0",
      clock: {
        interval: `${startTime.toISOString()}/${stopTime.toISOString()}`, // 总体时间范围
        currentTime: startTime.toISOString(), // 当前默认时间点
        multiplier: 60, // 时间流逝速率（1秒等于现实60秒）
        range: "LOOP_STOP", // 播放到底后循环
      },
    },
  ];

  // 遍历传入的卫星 TLE 数据
  tleArray.forEach((item, index) => {
    const { name, line1, line2 } = item;

    // 基础校验：TLE 格式通常为两行，每行约 69 字符
    if (!line1 || !line2 || line1.length < 60 || line2.length < 60) return;

    try {
      // 1. 解析 TLE 字符串，生成卫星轨道记录对象 (satrec)
      const satrec = satellite.twoline2satrec(line1, line2);
      if (satrec.error > 0) return; // 如果解析出错则跳过

      const positions = [];
      // 2. 根据步长循环计算卫星在不同时间点的位置
      for (let m = 0; m <= durationHours * 60; m += stepMinutes) {
        const time = new Date(startTime.getTime() + m * 60000); // 当前迭代时间

        // 3. 轨道外推：计算 ECI (地心惯性坐标系) 下的位置和速度
        const positionAndVelocity = satellite.propagate(satrec, time);
        const positionEci = positionAndVelocity.position;

        if (positionEci) {
          // 4. 计算恒星时 (GMST) 用于坐标系转换
          const gmst = satellite.gstime(time);

          // 5. 将 ECI 坐标转换为地理坐标（经度、纬度、高度）
          const posGd = satellite.eciToGeodetic(positionEci, gmst);

          // 6. 弧度转度数
          const lon = (posGd.longitude * 180) / Math.PI;
          const lat = (posGd.latitude * 180) / Math.PI;
          const alt = posGd.height * 1000; // satellite.js 使用 km，Cesium 坐标需要 m

          // 7. 过滤异常值，将时间、经、纬、高按顺序压入数组（Cesium cartographicDegrees 格式）
          if (!isNaN(lon) && !isNaN(lat)) {
            positions.push(time.toISOString(), lon, lat, alt);
          }
        }
      }

      // 只有当存在有效位置数据时才添加该卫星实体到 CZML
      if (positions.length > 0) {
        // 生成随机浅色系颜色，RGBA 格式
        const randomColor = [
          Math.floor(Math.random() * 155) + 100, // R
          Math.floor(Math.random() * 155) + 100, // G
          255, // B
          255, // A
        ];

        // 构建卫星实体对象
        czml.push({
          id: `Sat_${name.replace(/\s+/g, "_")}_${index}`, // 唯一 ID，将空格换为下划线
          name: name,
          billboard: {
            image: images[index % images.length], // 循环选用图标
            color: { rgba: randomColor }, // 颜色叠加
            width: 24,
            height: 24,
            verticalOrigin: "CENTER",
            horizontalOrigin: "CENTER",
            disableDepthTestDistance: 1.2742e7, // 高度超过地径时防止被地球遮挡（防止深度冲突）
          },
          path: {
            show: true, // 显示运行轨迹线
            width: 1.0,
            material: {
              polylineGlow: {
                // 发光材质
                color: { rgba: randomColor },
                glowPower: 0.2,
              },
            },
            leadTime: 1280, // 预测线长度（秒）
            trailTime: 1280, // 尾迹保留时间（秒）
            resolution: 120, // 采样率
          },
          position: {
            interpolationAlgorithm: "LAGRANGE", // 拉格朗日插值法，让卫星移动更平滑
            interpolationDegree: 2, // 插值算法次数
            cartographicDegrees: positions, // 位置数据源
          },
        });
      }
    } catch (e) {
      console.warn(`解析卫星 [${name}] 失败:`, e.message);
    }
  });

  return czml; // 返回构建完成的 CZML 数组
}
/**
 * 关键概念解释：ECI (Earth-Centered Inertial): 地心惯性坐标系。卫星在太空中的运动是相对于恒星背景的，因此 satellite.propagate 首先算出的是这个坐标。
 * Geodetic (地理坐标): 为了在地图上显示，需要通过 gmst（格林尼治恒星时）将 ECI 转换为相对于转动的地球表面的坐标。
 * Lagrange 插值: 因为数据是每隔 $N$ 分钟采样一次，Cesium 使用插值算法来平滑地补全采样点之间的位置。您需要我为您展示如何
 */
