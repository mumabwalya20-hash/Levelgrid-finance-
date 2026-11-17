import {
  createClient,
  isAuthRetryableFetchError,
  type AuthError,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { FinanceDatabase } from "./database";
import { departmentFromCloud, syncFinance, type CloudDepartment, type SyncStatus } from "./sync";

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const trustKey = "levelgrid-finance:" + projectUrl + ":trusted-session";

interface SessionProof {
  ownerId: string;
  refreshToken: string;
}

interface DeviceTrust extends SessionProof {
  deviceId: string;
}

export type OwnerAccess =
  | { screen: "checking" | "setup" }
  | { screen: "sign-in"; message?: string }
  | { screen: "finance"; database: FinanceDatabase; offline: boolean; trusted: boolean };

class AccessError extends Error {
  constructor(message: string, readonly reason: "unavailable" | "denied" | "setup") {
    super(message);
  }
}

function readTrust(): DeviceTrust | null {
  const saved = localStorage.getItem(trustKey);
  if (!saved) return null;
  try {
    const value = JSON.parse(saved) as Partial<DeviceTrust> | null;
    if (
      typeof value?.deviceId === "string" &&
      typeof value.ownerId === "string" &&
      typeof value.refreshToken === "string" &&
      value.refreshToken
    ) {
      return { deviceId: value.deviceId, ownerId: value.ownerId, refreshToken: value.refreshToken };
    }
  } catch {
    // A corrupt trust record never grants access.
  }
  return null;
}

function storeTrust(trust: DeviceTrust) {
  localStorage.setItem(trustKey, JSON.stringify(trust));
}

function authUnavailable(error: AuthError | null) {
  return error && (isAuthRetryableFetchError(error) || error.status === 429 || (error.status ?? 0) >= 500);
}

function sessionProof(session: Session): SessionProof {
  return { ownerId: session.user.id, refreshToken: session.refresh_token };
}

function databaseAccessError(status: number) {
  if (status === 0 || status === 429 || status >= 500) {
    return new AccessError("Couldn't reach Supabase. Try again when connected.", "unavailable");
  }
  if (status === 401 || status === 403) {
    return new AccessError("This session no longer has access. Sign in again.", "denied");
  }
  return new AccessError("Finance database setup is incomplete. Check the Supabase migration.", "setup");
}

function messageFor(error: unknown) {
  return error instanceof AccessError
    ? error.message
    : "Couldn't open this phone's saved data. Reopen the app and try again.";
}

export class OwnerSession {
  private client: SupabaseClient | null = null;
  private database: FinanceDatabase | null = null;
  private memorySession: SessionProof | null = null;
  private deviceId: string | null = null;
  private generation = 0;
  private disposed = false;
  private operations = Promise.resolve();
  private verifiedUntil = 0;
  private syncRequested = false;
  private syncScheduled = false;

  constructor(
    private readonly show: (access: OwnerAccess) => void,
    private readonly showSync: (status: SyncStatus) => void,
  ) {}

  start() {
    if (!projectUrl || !publishableKey) {
      this.show({ screen: "setup" });
      return;
    }
    window.addEventListener("online", this.resume);
    window.addEventListener("offline", this.resume);
    window.addEventListener("storage", this.onStorage);
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.checkAccess(true);
  }

  dispose() {
    this.disposed = true;
    this.generation += 1;
    window.removeEventListener("online", this.resume);
    window.removeEventListener("offline", this.resume);
    window.removeEventListener("storage", this.onStorage);
    document.removeEventListener("visibilitychange", this.onVisibility);
    void this.client?.auth.dispose();
    this.closeDatabase();
  }

  signIn(email: string, password: string, trustDevice: boolean) {
    const generation = this.generation;
    return this.serialize(async () => {
      if (!this.isCurrent(generation)) return;
      if (!navigator.onLine) {
        this.show({ screen: "sign-in", message: "Connect to the internet to sign in." });
        return;
      }

      let sessionCreated = false;
      try {
        const { data, error } = await this.getClient().auth.signInWithPassword({ email, password });
        if (!this.isCurrent(generation)) return;
        if (authUnavailable(error)) {
          throw new AccessError("Couldn't reach Supabase. Try again when connected.", "unavailable");
        }
        if (error || !data.session) {
          throw new AccessError("Check your email and password and try again.", "denied");
        }

        sessionCreated = true;
        const proof = sessionProof(data.session);
        const database = await this.verifyDatabase(proof.ownerId);
        if (!this.isCurrent(generation)) return;

        if (trustDevice) {
          const trusted = { ...proof, deviceId: crypto.randomUUID() };
          storeTrust(trusted);
          this.deviceId = trusted.deviceId;
          this.memorySession = null;
          void navigator.storage?.persist?.().catch(() => undefined);
        } else {
          localStorage.removeItem(trustKey);
          this.deviceId = null;
          this.memorySession = proof;
        }
        if (navigator.onLine || trustDevice) {
          this.show({ screen: "finance", database, offline: !navigator.onLine, trusted: trustDevice });
          if (navigator.onLine) this.startVerifiedSync(data.session);
        } else {
          this.lock("Connect to the internet to open your records.");
        }
      } catch (error) {
        if (!this.isCurrent(generation)) return;
        this.lock(messageFor(error));
        if (sessionCreated) {
          const client = this.client;
          this.client = null;
          await this.endSession(client);
        }
      }
    });
  }

  signOut() {
    try {
      localStorage.removeItem(trustKey);
    } catch {
      return false;
    }
    const client = this.client;
    this.generation += 1;
    this.memorySession = null;
    this.client = null;
    this.deviceId = null;
    this.lock("Signed out. Sign in online to open your saved records.");
    void this.serialize(() => this.endSession(client));
    return true;
  }

  syncNow() {
    if (!navigator.onLine || !this.database || this.disposed) return;
    if (this.verifiedUntil < Date.now() + 60_000) {
      void this.checkAccess(false);
      return;
    }

    this.syncRequested = true;
    if (this.syncScheduled) return;
    this.syncScheduled = true;
    const generation = this.generation;
    void this.serialize(async () => {
      this.syncRequested = false;
      const active = () => this.isCurrent(generation) && navigator.onLine && this.verifiedUntil > Date.now();
      if (!active() || !this.database || !this.client) return;
      this.showSync("working");
      const status = await syncFinance(this.database, this.client, active);
      if (this.isCurrent(generation)) this.showSync(status);
    }).catch(() => {
      if (this.isCurrent(generation)) this.showSync("retry");
    }).finally(() => {
      this.syncScheduled = false;
      if (this.syncRequested) this.syncNow();
    });
  }

  private startVerifiedSync(session: Session) {
    this.verifiedUntil = session.expires_at ? session.expires_at * 1000 : Date.now() + session.expires_in * 1000;
    if (this.verifiedUntil >= Date.now() + 60_000) this.syncNow();
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === "visible") this.resume();
  };

  private readonly onStorage = (event: StorageEvent) => {
    if ((event.key === trustKey || event.key === null) && this.deviceId) {
      let stillTrusted = false;
      try {
        stillTrusted = readTrust()?.deviceId === this.deviceId;
      } catch {
        // A storage failure cannot renew trust.
      }
      if (!stillTrusted) {
        this.generation += 1;
        this.deviceId = null;
        this.memorySession = null;
        void this.client?.auth.dispose();
        this.client = null;
        this.lock("Sign in online to open your saved records.");
      }
    }
  };

  private readonly resume = () => {
    this.verifiedUntil = 0;
    void this.checkAccess(false);
  };

  private checkAccess(initial: boolean) {
    const generation = this.generation;
    return this.serialize(async () => {
      if (!this.isCurrent(generation)) return;
      let trusted: DeviceTrust | null = null;

      try {
        trusted = this.memorySession ? null : readTrust();
        this.deviceId = trusted?.deviceId ?? null;
        const proof = trusted ?? this.memorySession;
        if (!proof) {
          if (initial || this.database) this.lock();
          return;
        }
        if (!navigator.onLine) {
          if (trusted) await this.openOffline(trusted, generation);
          else this.lock("Connect to the internet to open your records.");
          return;
        }

        const { data, error } = await this.getClient().auth.refreshSession({ refresh_token: proof.refreshToken });
        if (!this.isCurrent(generation)) return;
        if (authUnavailable(error)) {
          throw new AccessError("Couldn't reach Supabase. Try again when connected.", "unavailable");
        }
        if (error || !data.session || data.session.user.id !== proof.ownerId) {
          throw new AccessError("Your session ended. Sign in online again.", "denied");
        }

        const refreshed = sessionProof(data.session);
        if (trusted) {
          // Save the rotated token before the next network call.
          if (readTrust()?.deviceId !== trusted.deviceId) return;
          storeTrust({ ...refreshed, deviceId: trusted.deviceId });
        } else {
          this.memorySession = refreshed;
        }
        const database = await this.verifyDatabase(refreshed.ownerId);
        if (!this.isCurrent(generation)) return;
        if (trusted && readTrust()?.deviceId !== trusted.deviceId) return;

        if (navigator.onLine || trusted) {
          this.show({ screen: "finance", database, offline: !navigator.onLine, trusted: trusted !== null });
          if (navigator.onLine) this.startVerifiedSync(data.session);
        } else {
          this.lock("Connect to the internet to open your records.");
        }
      } catch (error) {
        if (!this.isCurrent(generation)) return;
        if (trusted && error instanceof AccessError && error.reason === "unavailable") {
          try {
            await this.openOffline(trusted, generation);
          } catch (offlineError) {
            if (this.isCurrent(generation)) this.lock(messageFor(offlineError));
          }
          return;
        }
        if (error instanceof AccessError && error.reason === "denied") {
          this.memorySession = null;
          void this.client?.auth.dispose();
          this.client = null;
          this.deviceId = null;
          try {
            if (trusted && readTrust()?.deviceId === trusted.deviceId) localStorage.removeItem(trustKey);
          } catch {
            // Keep the UI locked if storage is unavailable.
          }
        }
        this.lock(messageFor(error));
      }
    });
  }

  private async openOffline(trusted: DeviceTrust, generation: number) {
    const database = this.getDatabase(trusted.ownerId);
    if (await database.departments.count() === 0) {
      throw new AccessError("Connect to the internet to finish setting up this phone.", "setup");
    }
    if (this.isCurrent(generation) && readTrust()?.deviceId === trusted.deviceId) {
      this.verifiedUntil = 0;
      this.showSync("idle");
      this.show({ screen: "finance", database, offline: true, trusted: true });
    }
  }

  private async verifyDatabase(ownerId: string) {
    const database = this.getDatabase(ownerId);
    const client = this.getClient();
    if (await database.departments.count() === 0) {
      const result = await client.from("finance_departments")
        .select("id,name,position,created_at,updated_at,deactivated_at,revision")
        .order("position")
        .overrideTypes<CloudDepartment[], { merge: false }>();
      if (result.error) throw databaseAccessError(result.status);
      if (!result.data?.length) throw new AccessError("This account does not have Owner access.", "denied");

      await database.initializeDepartments(result.data.map(departmentFromCloud));
    } else {
      const result = await client.from("finance_departments").select("id").limit(1);
      if (result.error) throw databaseAccessError(result.status);
      if (!result.data?.length) throw new AccessError("This account does not have Owner access.", "denied");
    }
    return database;
  }

  private async endSession(client: SupabaseClient | null) {
    if (!client) return;
    if (navigator.onLine) {
      // The device lock takes effect before this best-effort server sign-out.
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
    await client.auth.dispose();
  }

  private isCurrent(generation: number) {
    return !this.disposed && this.generation === generation;
  }

  private serialize(operation: () => Promise<void>) {
    const task = this.operations.then(async () => {
      // Chrome serializes refresh-token rotation across the installed app and browser tabs.
      await (navigator.locks ? navigator.locks.request(trustKey, operation) : operation());
    });
    this.operations = task.catch(() => undefined);
    return task;
  }

  private getClient() {
    this.client ??= createClient(projectUrl!, publishableKey!, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: {
        fetch(input, init) {
          const timeout = AbortSignal.timeout(7_000);
          const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
          return fetch(input, { ...init, signal });
        },
      },
    });
    return this.client;
  }

  private getDatabase(ownerId: string) {
    if (this.database?.ownerId !== ownerId) {
      this.closeDatabase();
      this.database = new FinanceDatabase(projectUrl!, ownerId);
    }
    return this.database!;
  }

  private closeDatabase() {
    this.database?.close();
    this.database = null;
  }

  private lock(message?: string) {
    this.verifiedUntil = 0;
    this.syncRequested = false;
    this.showSync("idle");
    this.closeDatabase();
    this.show({ screen: "sign-in", message });
  }
}
