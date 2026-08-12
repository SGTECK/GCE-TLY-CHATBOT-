"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";

export default function CollegeLogo({ size = 36 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex items-center justify-center rounded-full text-white bg-navy shrink-0"
        style={{ width: size, height: size }}
      >
        <GraduationCap size={size * 0.5} />
      </div>
    );
  }

  return (
    <img
      src="https://gcetly.ac.in/imgs/gcelogo.jpg"
      alt="Government College of Engineering, Tirunelveli official logo"
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0 bg-white"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
