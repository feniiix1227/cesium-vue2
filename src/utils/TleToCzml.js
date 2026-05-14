import * as satellite from "satellite.js";

/**
 * 将 TLE 数组转换为 CZML 对象
 * @param {Array} tleArray - 包含 {name, line1, line2} 的数组
 * @param {Object} options - 配置项 (durationHours: 持续小时数, stepMinutes: 采样频率)
 */
export function convertTleToPureCzml(tleArray, options = {}) {
  const { durationHours = 12, stepMinutes = 10 } = options;
  const startTime = new Date();
  const stopTime = new Date(startTime.getTime() + durationHours * 3600000);

  // 卫星图标 Base64
  const images = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAATVJREFUOE+lU1FOg0AQfbPLMfzgAiXa+i/ESygxAU5SOYixTQx6i2L8tdXQA8hBZNfMwiICxRr3Z5OZee/N7Jsl/PPQGP7t9MqVUiyrSqVn70/llMaAoAF/NKCyqlQwRTIgKBYhg92O6srbZsl+Hi45NttlabejAQEXasJtW6SRgHQEkG9iGom3y1Y2P/oGDUkMIAfA9/c5hsBWF4vrTatcy+fe9jGYHMEm9+c3vtZq01cH4aLrzrgLQviVUrmU4gXACSsDxHbacVp3fhD0VE2R4zju7PUhP+SOISjmYWwUhfC5RatEJAIGc03PnZJIJJwzBMZjIZ61VpH61HdS0iVb2SXokMQWzLGaoH6we2ik3AGRWJuladSPWuXWe42Ux/ntD4wuUtNJRBplf2UPdTG6iX/54V8KW6IRUj57xgAAAABJRU5ErkJggg==",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAWBJREFUOE+Nk01SAjEQhd/LeAB/DmCoUqo8hcNJkCV6CPQQylI4CXAKqmRhPIAUe4e01QkZZoI/ZDM/SX/z+vUbYrcunt/uxPDSo5puhjcuvf/vSj1wPl6N9EovH57sC6vBsRDmxSQdIO5YJTsArRYBtPR+oWqEGK3vux29Px0v7W+KGi3Qesi08GLFmFst1GcKRgRKT/Q2w+t57kkANH1QFSJitSioIicQPAYgq06upAY0Idq/kZN3AeYRtFvkZD28GjRVtABp4+xlNatraoA4z23vTwXRsFVpRF4FdPnX1ROgck3IgYIIQK0gKokTAtULNfvrKUEYCsB+OuiBhSoIBcE49HRfx6tJDThBmcJGnbGRYpYKQoiyXtWTFLC9gVFJaOEAkrmd0ho/ou00MOm2DRGXUtjOSUxqakXH3TJxDwFygILSHxtTioUm84cpLG3hi/LzoTvJY5sgW0OXYv0NlavRUORHSncAAAAASUVORK5CYII=",
  ];

  const czml = [
    {
      id: "document",
      version: "1.0",
      clock: {
        interval: `${startTime.toISOString()}/${stopTime.toISOString()}`,
        currentTime: startTime.toISOString(),
        multiplier: 60,
        range: "LOOP_STOP",
      },
    },
  ];

  tleArray.forEach((item, index) => {
    const { name, line1, line2 } = item;
    // 基础校验
    if (!line1 || !line2 || line1.length < 60 || line2.length < 60) return;

    try {
      const satrec = satellite.twoline2satrec(line1, line2);
      if (satrec.error > 0) return; // 轨道参数错误

      const positions = [];
      for (let m = 0; m <= durationHours * 60; m += stepMinutes) {
        const time = new Date(startTime.getTime() + m * 60000);
        const positionAndVelocity = satellite.propagate(satrec, time);
        const positionEci = positionAndVelocity.position;

        if (positionEci) {
          const gmst = satellite.gstime(time);
          const posGd = satellite.eciToGeodetic(positionEci, gmst);

          const lon = (posGd.longitude * 180) / Math.PI;
          const lat = (posGd.latitude * 180) / Math.PI;
          const alt = posGd.height * 1000; // satellite.js 使用 km，Cesium 需要 m

          // 确保经纬度是有效数字，避免渲染异常
          if (!isNaN(lon) && !isNaN(lat)) {
            positions.push(time.toISOString(), lon, lat, alt);
          }
        }
      }

      // 只有当存在有效位置数据时才添加卫星
      if (positions.length > 0) {
        // 随机一个颜色，让卫星在地图上更好看
        const randomColor = [
          Math.floor(Math.random() * 155) + 100,
          Math.floor(Math.random() * 155) + 100,
          255,
          255,
        ];

        czml.push({
          id: `Sat_${name.replace(/\s+/g, "_")}_${index}`,
          name: name,
          billboard: {
            image: images[index % images.length],
            color: { rgba: randomColor },
            width: 24,
            height: 24,
            verticalOrigin: "CENTER",
            horizontalOrigin: "CENTER",
            disableDepthTestDistance: 1.2742e7, // 远距离时防止被地球遮挡
          },
          path: {
            show: true,
            width: 1.0,
            material: {
              polylineGlow: {
                color: { rgba: randomColor },
                glowPower: 0.2,
              },
            },
            leadTime: 1280, // 预测前半段
            trailTime: 1280, // 留下一段尾迹
            resolution: 120,
          },
          position: {
            interpolationAlgorithm: "LAGRANGE",
            interpolationDegree: 2,
            cartographicDegrees: positions,
          },
        });
      }
    } catch (e) {
      console.warn(`解析卫星 [${name}] 失败:`, e.message);
    }
  });

  return czml;
}
