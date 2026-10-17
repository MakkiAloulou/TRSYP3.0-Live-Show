import Image from "next/image";
import logo from "@/public/trsyp-logo.png";

/* Home of the big screen: the TRSYP logo, alone and large. Shown before the
   show starts, between games if wanted, and after the champion. */
export default function LogoScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* the logo's two colours, as light behind it */}
      <span
        aria-hidden
        className="logo-aura absolute h-[620px] w-[1500px]"
        style={{
          background:
            "radial-gradient(40% 50% at 30% 50%, rgba(0,232,122,0.16), transparent 70%), radial-gradient(40% 50% at 70% 50%, rgba(255,29,120,0.16), transparent 70%)",
        }}
      />
      <div className="logo-in relative flex flex-col items-center">
        <Image src={logo} alt="TRSYP 3.0" priority className="h-[230px] w-auto object-cover" style={{ aspectRatio: "2000 / 330" }} />
        <span
          aria-hidden
          className="mt-14 h-px w-[720px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(0,232,122,0.5) 25%, rgba(255,255,255,0.15) 50%, rgba(255,29,120,0.5) 75%, transparent)" }}
        />
      </div>
    </div>
  );
}
