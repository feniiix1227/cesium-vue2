<template>
  <div id="app">
    <CesiumMap />
  </div>
</template>

<script>
import CesiumMap from "./components/CesiumMap.vue";

export default {
  components: {
    CesiumMap,
  },
};
</script>

<style>
body,
html {
  margin: 0;
  padding: 0;
}
</style>
