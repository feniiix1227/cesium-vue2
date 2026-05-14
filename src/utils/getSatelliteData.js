const getSatelliteData = async function () {
  // 获取活跃卫星数据（包含几千颗卫星）
  const response = await fetch(
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
  );
  const data = await response.text();

  const lines = data.split("\n");
  const satelliteArray = [];

  // 每 3 行代表一个卫星（名称、Line 1、Line 2）
  for (let i = 0; i < lines.length; i += 3) {
    if (lines[i] && lines[i + 1] && lines[i + 2]) {
      satelliteArray.push({
        name: lines[i].trim(),
        line1: lines[i + 1].trim(),
        line2: lines[i + 2].trim(),
      });
    }
  }

  // 截取前 1000 个
  const top1000 = satelliteArray.slice(0, 1000);

  console.log(JSON.stringify(top1000, null, 2));
  return top1000;
};
export default getSatelliteData;
