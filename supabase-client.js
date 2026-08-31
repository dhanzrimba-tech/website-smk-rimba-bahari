/*
 * SMKK Rimba Bahari - Local Supabase-compatible client
 * V5 Cross Browser Repair
 *
 * Tujuan:
 * - Tidak lagi memuat @supabase/supabase-js dari CDN pihak ketiga.
 * - Menggunakan Fetch API langsung ke Supabase REST/Auth/Storage.
 * - Menyediakan API minimal yang kompatibel dengan fungsi website saat ini.
 */
(function (window) {
  "use strict";

  function makeError(response, body) {
    var message = "Permintaan ke server gagal.";
    if (body && typeof body === "object") {
      message = body.message || body.error_description || body.error || message;
    } else if (typeof body === "string" && body.trim()) {
      message = body;
    }
    var err = new Error(message);
    err.status = response && response.status;
    err.code = body && body.code;
    err.details = body && body.details;
    err.hint = body && body.hint;
    return err;
  }

  function safeStorage() {
    try {
      var key = "__smkk_storage_test__";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return window.localStorage;
    } catch (e) {
      try {
        return window.sessionStorage;
      } catch (e2) {
        return null;
      }
    }
  }

  function createClient(url, publishableKey) {
    var baseUrl = String(url || "").replace(/\/+$/, "");
    var apiBase = baseUrl + "/rest/v1";
    var authBase = baseUrl + "/auth/v1";
    var storageBase = baseUrl + "/storage/v1";
    var sessionKey = "smkk_supabase_session_v5";
    var storage = safeStorage();
    var memorySession = null;

    function readSession() {
      if (memorySession) return memorySession;
      if (!storage) return null;
      try {
        var raw = storage.getItem(sessionKey);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function saveSession(session) {
      memorySession = session || null;
      if (!storage) return;
      try {
        if (session) storage.setItem(sessionKey, JSON.stringify(session));
        else storage.removeItem(sessionKey);
      } catch (e) {}
    }

    function sessionExpired(session) {
      if (!session) return true;
      if (!session.expires_at) return false;
      return Date.now() >= (Number(session.expires_at) * 1000) - 30000;
    }

    async function refreshSession(session) {
      if (!session || !session.refresh_token) return null;
      try {
        var response = await fetch(authBase + "/token?grant_type=refresh_token", {
          method: "POST",
          headers: {
            "apikey": publishableKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        var body = await parseResponse(response);
        if (!response.ok) return null;

        var refreshed = {
          access_token: body.access_token,
          refresh_token: body.refresh_token || session.refresh_token,
          token_type: body.token_type || "bearer",
          expires_in: body.expires_in,
          expires_at: body.expires_at ||
            (Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600)),
          user: body.user || session.user || null
        };
        saveSession(refreshed);
        return refreshed;
      } catch (e) {
        return null;
      }
    }

    async function getActiveSession() {
      var session = readSession();
      if (!session) return null;
      if (!sessionExpired(session)) return session;
      return await refreshSession(session);
    }

    async function authHeaders(extra) {
      var session = await getActiveSession();
      var headers = {
        "apikey": publishableKey,
        "Authorization": "Bearer " + (session && session.access_token ? session.access_token : publishableKey)
      };
      if (extra) {
        Object.keys(extra).forEach(function (key) {
          headers[key] = extra[key];
        });
      }
      return headers;
    }

    async function parseResponse(response) {
      var text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    }

    async function request(url, options) {
      var response;
      try {
        response = await fetch(url, options);
      } catch (e) {
        var networkError = new Error("Koneksi ke server Supabase gagal. Periksa koneksi internet lalu coba lagi.");
        networkError.cause = e;
        throw networkError;
      }
      var body = await parseResponse(response);
      if (!response.ok) throw makeError(response, body);
      return body;
    }

    function QueryBuilder(table) {
      this.table = table;
      this.action = "select";
      this.columns = "*";
      this.filters = [];
      this.ordering = [];
      this.limitValue = null;
      this.singleMode = null;
      this.payload = null;
    }

    QueryBuilder.prototype.select = function (columns) {
      this.action = this.action === "select" ? "select" : this.action;
      this.columns = columns || "*";
      return this;
    };

    QueryBuilder.prototype.eq = function (column, value) {
      this.filters.push([column, "eq", value]);
      return this;
    };

    QueryBuilder.prototype.not = function (column, operator, value) {
      this.filters.push([column, "not." + operator, value]);
      return this;
    };

    QueryBuilder.prototype.order = function (column, options) {
      options = options || {};
      this.ordering.push(column + "." + (options.ascending === false ? "desc" : "asc"));
      return this;
    };

    QueryBuilder.prototype.limit = function (count) {
      this.limitValue = count;
      return this;
    };

    QueryBuilder.prototype.single = function () {
      this.singleMode = "single";
      return this;
    };

    QueryBuilder.prototype.maybeSingle = function () {
      this.singleMode = "maybe";
      return this;
    };

    QueryBuilder.prototype.insert = function (payload) {
      this.action = "insert";
      this.payload = payload;
      return this;
    };

    QueryBuilder.prototype.update = function (payload) {
      this.action = "update";
      this.payload = payload;
      return this;
    };

    QueryBuilder.prototype.delete = function () {
      this.action = "delete";
      this.payload = null;
      return this;
    };

    QueryBuilder.prototype._execute = async function () {
      var query = new URLSearchParams();

      if (this.action === "select") {
        query.set("select", this.columns || "*");
      }

      this.filters.forEach(function (filter) {
        var value = filter[2];
        if (value === null || typeof value === "undefined") value = "null";
        query.append(filter[0], filter[1] + "." + String(value));
      });

      if (this.ordering.length) query.set("order", this.ordering.join(","));
      if (this.limitValue !== null) query.set("limit", String(this.limitValue));

      var url = apiBase + "/" + encodeURIComponent(this.table);
      var options = {
        method: this.action === "select" ? "GET" :
                this.action === "insert" ? "POST" :
                this.action === "update" ? "PATCH" : "DELETE",
        headers: await authHeaders({
          "Accept": "application/json"
        })
      };

      if (this.action !== "select" && this.action !== "delete") {
        options.headers["Content-Type"] = "application/json";
      }

      if (this.action === "insert" || this.action === "update") {
        options.headers["Prefer"] = "return=representation";
        options.body = JSON.stringify(this.payload);
      } else if (this.action === "delete") {
        options.headers["Prefer"] = "return=representation";
      }

      if (query.toString()) url += "?" + query.toString();

      try {
        var data = await request(url, options);

        if (this.singleMode === "single") {
          if (!Array.isArray(data) || data.length !== 1) {
            return {
              data: null,
              error: new Error("Data yang diminta tidak ditemukan atau jumlahnya tidak tepat.")
            };
          }
          return { data: data[0], error: null };
        }

        if (this.singleMode === "maybe") {
          if (!Array.isArray(data) || data.length === 0) {
            return { data: null, error: null };
          }
          if (data.length > 1) {
            return {
              data: null,
              error: new Error("Ditemukan lebih dari satu data yang cocok.")
            };
          }
          return { data: data[0], error: null };
        }

        return { data: data, error: null };
      } catch (error) {
        return { data: null, error: error };
      }
    };

    QueryBuilder.prototype.then = function (resolve, reject) {
      return this._execute().then(resolve, reject);
    };

    QueryBuilder.prototype.catch = function (reject) {
      return this._execute().catch(reject);
    };

    function StorageBucket(bucket) {
      this.bucket = bucket;
    }

    StorageBucket.prototype.getPublicUrl = function (path) {
      var clean = String(path || "").replace(/^\/+/, "");
      var encoded = clean.split("/").map(encodeURIComponent).join("/");
      return {
        data: {
          publicUrl: storageBase + "/object/public/" + encodeURIComponent(this.bucket) + "/" + encoded
        }
      };
    };

    StorageBucket.prototype.upload = async function (path, file, options) {
      options = options || {};
      var clean = String(path || "").replace(/^\/+/, "");
      var encoded = clean.split("/").map(encodeURIComponent).join("/");
      var headers = await authHeaders({
        "x-upsert": options.upsert ? "true" : "false",
        "cache-control": options.cacheControl || "3600"
      });

      if (options.contentType) headers["Content-Type"] = options.contentType;
      else if (file && file.type) headers["Content-Type"] = file.type;

      try {
        var response = await fetch(
          storageBase + "/object/" + encodeURIComponent(this.bucket) + "/" + encoded,
          {
            method: "POST",
            headers: headers,
            body: file
          }
        );
        var body = await parseResponse(response);
        if (!response.ok) return { data: null, error: makeError(response, body) };
        return { data: body, error: null };
      } catch (e) {
        return {
          data: null,
          error: new Error("Upload foto gagal. Periksa koneksi internet lalu coba lagi.")
        };
      }
    };

    var client = {
      from: function (table) {
        return new QueryBuilder(table);
      },
      storage: {
        from: function (bucket) {
          return new StorageBucket(bucket);
        }
      },
      auth: {
        getSession: async function () {
          var session = await getActiveSession();
          return { data: { session: session }, error: null };
        },

        signInWithPassword: async function (credentials) {
          try {
            var body = await request(authBase + "/token?grant_type=password", {
              method: "POST",
              headers: {
                "apikey": publishableKey,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password
              })
            });

            var session = {
              access_token: body.access_token,
              refresh_token: body.refresh_token,
              token_type: body.token_type || "bearer",
              expires_in: body.expires_in,
              expires_at: body.expires_at ||
                (Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600)),
              user: body.user || null
            };

            saveSession(session);
            return { data: { session: session, user: body.user || null }, error: null };
          } catch (error) {
            return { data: { session: null, user: null }, error: error };
          }
        },

        signOut: async function () {
          var session = await getActiveSession();
          if (session && session.access_token) {
            try {
              await fetch(authBase + "/logout", {
                method: "POST",
                headers: {
                  "apikey": publishableKey,
                  "Authorization": "Bearer " + session.access_token
                }
              });
            } catch (e) {}
          }
          saveSession(null);
          return { error: null };
        }
      }
    };

    return client;
  }

  window.supabase = {
    createClient: createClient
  };
})(window);
