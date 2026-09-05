"use client";

import { getFirebaseAuth, getFirebaseFirestore } from "@webrecon/firebase/client";

export const auth = getFirebaseAuth();
export const db = getFirebaseFirestore();
