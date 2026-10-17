import type { Metadata } from "next";
import Controller from "@/components/control/Controller";

export const metadata: Metadata = {
  title: "Controller · TRSYP 3.0",
  robots: { index: false, follow: false },
};

export default function ControlPage() {
  return <Controller />;
}
