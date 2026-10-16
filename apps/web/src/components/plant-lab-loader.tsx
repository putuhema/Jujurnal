"use client";

import dynamic from "next/dynamic";

export const PlantLabLoader = dynamic(() => import("./plant-lab"), { ssr: false });
