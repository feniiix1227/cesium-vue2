import Vue from "vue";
import App from "./App.vue";
// 引入 Cesium 样式
import "cesium/Widgets/widgets.css";

Vue.config.productionTip = false;

new Vue({
  render: (h) => h(App),
}).$mount("#app");
