/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as biomarkers from "../biomarkers.js";
import type * as chat from "../chat.js";
import type * as dna from "../dna.js";
import type * as habits from "../habits.js";
import type * as household from "../household.js";
import type * as lib_auth from "../lib/auth.js";
import type * as notes from "../notes.js";
import type * as passwordReset from "../passwordReset.js";
import type * as profile from "../profile.js";
import type * as push from "../push.js";
import type * as reminders from "../reminders.js";
import type * as reports from "../reports.js";
import type * as supplements from "../supplements.js";
import type * as symptoms from "../symptoms.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";
import type * as wearables from "../wearables.js";
import type * as weekly from "../weekly.js";
import type * as whoami from "../whoami.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  biomarkers: typeof biomarkers;
  chat: typeof chat;
  dna: typeof dna;
  habits: typeof habits;
  household: typeof household;
  "lib/auth": typeof lib_auth;
  notes: typeof notes;
  passwordReset: typeof passwordReset;
  profile: typeof profile;
  push: typeof push;
  reminders: typeof reminders;
  reports: typeof reports;
  supplements: typeof supplements;
  symptoms: typeof symptoms;
  users: typeof users;
  waitlist: typeof waitlist;
  wearables: typeof wearables;
  weekly: typeof weekly;
  whoami: typeof whoami;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
