import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// dev only: let a phone on the same network (Wi-Fi or the phone's own hotspot)
// open the controller from this PC, whatever address the PC has right now
const localAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: localAddresses,
  // nothing of Next's own on the projector or the phone, even in dev
  devIndicators: false,
};

export default nextConfig;
