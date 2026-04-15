import "server-only";

import mongoose from "mongoose";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export class QuantAuthError extends Error {
  constructor(message = "Sign in to use this quant workspace.") {
    super(message);
    this.name = "QuantAuthError";
  }
}

export const getOptionalSessionUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return token ? verifySessionToken(token) : null;
};

export const getOptionalUserObjectId = async () => {
  const user = await getOptionalSessionUser();

  if (!user) return null;

  return mongoose.Types.ObjectId.isValid(user.id)
    ? new mongoose.Types.ObjectId(user.id)
    : null;
};

export const getRequiredUserObjectId = async () => {
  const userId = await getOptionalUserObjectId();

  if (!userId) {
    throw new QuantAuthError();
  }

  return userId;
};
