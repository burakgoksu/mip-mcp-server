// ─── Token Management ─────────────────────────────────────────────────────────
import axios from "axios";
import { BASE_URL, MIP_USERNAME, MIP_PASSWORD } from "./config.js";

let tokenState = { token: null, expiry: 0 };

export async function getToken() {
  if (tokenState.token && Date.now() < tokenState.expiry - 30000) {
    return tokenState.token;
  }
  const res = await axios.post(`${BASE_URL}/api/auth/sign-in`, {
    username: MIP_USERNAME,
    password: MIP_PASSWORD,
  });
  tokenState.token = res.data.token;
  const expiresIn = res.data.expires_in ?? 3600;
  tokenState.expiry = Date.now() + expiresIn * 1000;
  return tokenState.token;
}

export function authHeaders() {
  return { Authorization: `Bearer ${tokenState.token}` };
}
