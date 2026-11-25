export default defineEventHandler(() => {
  return {
    status: "ok",
    service: "seller",
    timestamp: new Date().toISOString(),
  };
});
