import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
let client = null;
let configurationError = null;
if (configured) {
  try {
    client = createClient(url, key);
  } catch {
    configurationError = new Error(
      "The reservation service configuration is invalid. Check the Supabase project URL and public key, then restart the app.",
    );
  }
}
export const supabase = client;
function requireClient() {
  if (configurationError) throw configurationError;
  if (!client)
    throw new Error(
      "This is a design preview. Reservations are available once the app is connected.",
    );
  return client;
}
export async function rpc(name, args) {
  const { data, error } = await requireClient().rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function getLocations() {
  const { data, error } = await requireClient()
    .from("locations")
    .select("id,name")
    .order("id");
  if (error) throw new Error(error.message);
  return data;
}
