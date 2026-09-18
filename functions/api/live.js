// ============================================================================
// CLOUDFLARE PAGES FUNCTION
// FILE: /functions/api/live.js
//
// ROUTE:
//   /api/live?id=COURSE_ID
//
// EXAMPLE:
//   /api/live?id=8
//
// TOKEN SOURCE:
//   /tokens.json
//
// FLOW:
//
//   /api/live?id=8
//          |
//          v
//   /tokens.json
//          |
//          v
//   Find matching batch_id = 8
//          |
//          v
//   Read userId + token SERVER-SIDE
//          |
//          v
//   Call ClassX Live API
//          |
//          v
//   Decrypt encrypted response values
//          |
//          v
//   Return decoded response
//
// IMPORTANT:
//   - No hardcoded user ID
//   - No hardcoded authentication token
//   - userId and token are never returned
//   - Credentials are used only for the upstream request
// ============================================================================


// ============================================================================
// SETTINGS
// ============================================================================

function resolveTokenUrl(request, env) {
    if (env && env.TOKENS_URL) {
        return env.TOKENS_URL;
    }
    if (request && request.url) {
        return new URL("/tokens.json", request.url).href;
    }
    return "/tokens.json";
}

const LIVE_API =
    "https://sachinacademyapi.classx.co.in/get/live_upcoming_course_classv2";

// AES key supplied by you
const DECRYPTION_KEY =
    "638udh3829162018";


// ============================================================================
// RESPONSE HEADERS
// ============================================================================

const HEADERS = {

    "Access-Control-Allow-Origin":
        "*",

    "Access-Control-Allow-Methods":
        "GET, OPTIONS",

    "Access-Control-Allow-Headers":
        "*",

    "Content-Type":
        "application/json; charset=UTF-8",

    "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",

    "Pragma":
        "no-cache"

};


// ============================================================================
// JSON RESPONSE HELPER
// ============================================================================

function jsonResponse(
    payload,
    status = 200
) {

    return new Response(

        JSON.stringify(
            payload,
            null,
            4
        ),

        {
            status,
            headers:
                HEADERS
        }

    );

}


// ============================================================================
// READ COURSE ID
// ============================================================================

function getCourseId(request) {

    const url =
        new URL(
            request.url
        );

    const rawId =
        url.searchParams.get(
            "id"
        );

    if (
        rawId === null ||
        rawId === undefined
    ) {

        return "";

    }

    return String(
        rawId
    ).trim();

}


// ============================================================================
// FETCH TOKENS.JSON
// ============================================================================

async function fetchTokens(request, env) {

    const tokenUrl = resolveTokenUrl(request, env);

    const response =
        await fetch(

            tokenUrl,

            {
                method:
                    "GET",

                headers: {

                    "Accept":
                        "application/json"

                },

                cache:
                    "no-store"

            }

        );


    if (!response.ok) {

        throw new Error(
            `Token source returned HTTP ${response.status}`
        );

    }


    let json;


    try {

        json =
            await response.json();

    } catch {

        throw new Error(
            "tokens.json returned invalid JSON."
        );

    }


    if (
        !json ||
        typeof json !== "object"
    ) {

        throw new Error(
            "Invalid tokens.json response."
        );

    }


    if (
        !Array.isArray(
            json.data
        )
    ) {

        throw new Error(
            "tokens.json does not contain data[]."
        );

    }


    return json;

}


// ============================================================================
// FIND MATCHING BATCH
// ============================================================================
//
// Match:
//
//   tokens.json data[].batch_id
//
// with:
//
//   /api/live?id=
//
// Supports:
//
//   batch_id
//   batchId
//   id
//
// User ID:
//
//   userId
//   user_id
//
// Token:
//
//   token
//   authorization
//
// Credentials remain server-side.
// ============================================================================

function findMatchingBatch(
    tokenData,
    courseId
) {

    const wantedId =
        String(
            courseId
        ).trim();


    for (
        const item
        of tokenData
    ) {

        if (
            !item ||
            typeof item !== "object"
        ) {

            continue;

        }


        const rawBatchId =
            item.batch_id ??
            item.batchId ??
            item.id;


        if (
            rawBatchId === undefined ||
            rawBatchId === null
        ) {

            continue;

        }


        const batchId =
            String(
                rawBatchId
            ).trim();


        if (
            batchId !== wantedId
        ) {

            continue;

        }


        const rawUserId =
            item.userId ??
            item.user_id;


        const rawToken =
            item.token ??
            item.authorization;


        if (
            rawUserId === undefined ||
            rawUserId === null ||
            rawToken === undefined ||
            rawToken === null
        ) {

            return null;

        }


        const userId =
            String(
                rawUserId
            ).trim();


        const token =
            String(
                rawToken
            ).trim();


        if (
            !userId ||
            !token
        ) {

            return null;

        }


        return {

            userId,

            token,

            batchId

        };

    }


    return null;

}


// ============================================================================
// BUILD LIVE API URL
// ============================================================================

function buildLiveUrl(
    courseId
) {

    const url =
        new URL(
            LIVE_API
        );


    url.searchParams.set(
        "courseid",
        courseId
    );


    url.searchParams.set(
        "start",
        "-1"
    );


    return url.toString();

}


// ============================================================================
// FETCH LIVE CLASSES
// ============================================================================

async function fetchLiveClasses(
    courseId,
    account
) {

    const liveUrl =
        buildLiveUrl(
            courseId
        );


    const response =
        await fetch(

            liveUrl,

            {
                method:
                    "GET",

                headers: {

                    "Accept":
                        "*/*",

                    "Auth-Key":
                        "appxapi",

                    "Authorization":
                        account.token,

                    "Client-Service":
                        "Appx",

                    "Device-Type":
                        "",

                    "Is-Safari":
                        "0",

                    "Source":
                        "website",

                    "User-Id":
                        account.userId

                },

                cache:
                    "no-store"

            }

        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Live API returned HTTP ${response.status}`
        );

    }


    let json;


    try {

        json =
            await response.json();

    } catch {

        throw new Error(
            "Live API returned invalid JSON."
        );

    }


    if (
        !json ||
        typeof json !== "object"
    ) {

        throw new Error(
            "Invalid Live API response."
        );

    }


    return json;

}


// ============================================================================
// BASE64 -> UINT8ARRAY
// ============================================================================

function base64ToUint8Array(
    base64
) {

    try {

        if (
            typeof base64 !== "string"
        ) {

            return null;

        }


        let normalized =
            base64
                .replace(
                    /-/g,
                    "+"
                )
                .replace(
                    /_/g,
                    "/"
                );


        while (
            normalized.length % 4 !== 0
        ) {

            normalized += "=";

        }


        const binary =
            atob(
                normalized
            );


        const bytes =
            new Uint8Array(
                binary.length
            );


        for (
            let i = 0;
            i < binary.length;
            i++
        ) {

            bytes[i] =
                binary.charCodeAt(i);

        }


        return bytes;

    } catch {

        return null;

    }

}


// ============================================================================
// AES-CBC DECRYPTION
// ============================================================================
//
// Equivalent to:
//
// const [cipher, iv] = enc.split(":");
//
// const key = CryptoJS.enc.Utf8.parse(
//     "638udh3829162018"
// );
//
// const decrypted = CryptoJS.AES.decrypt(
//     { ciphertext: CryptoJS.enc.Base64.parse(cipher) },
//     key,
//     {
//         iv: CryptoJS.enc.Base64.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7
//     }
// );
//
// ============================================================================

async function decrypt(
    enc
) {

    try {

        if (
            typeof enc !== "string"
        ) {

            return null;

        }


        const parts =
            enc.split(":");


        if (
            parts.length !== 2
        ) {

            return null;

        }


        const cipher =
            parts[0];

        const iv =
            parts[1];


        if (
            !cipher ||
            !iv
        ) {

            return null;

        }


        const cipherBytes =
            base64ToUint8Array(
                cipher
            );


        const ivBytes =
            base64ToUint8Array(
                iv
            );


        if (
            !cipherBytes ||
            !ivBytes
        ) {

            return null;

        }


        // AES-CBC requires exactly 16-byte IV.
        if (
            ivBytes.length !== 16
        ) {

            return null;

        }


        const keyBytes =
            new TextEncoder().encode(
                DECRYPTION_KEY
            );


        // "638udh3829162018" is 16 bytes.
        if (
            keyBytes.length !== 16
        ) {

            return null;

        }


        const cryptoKey =
            await crypto.subtle.importKey(

                "raw",

                keyBytes,

                {
                    name:
                        "AES-CBC"
                },

                false,

                [
                    "decrypt"
                ]

            );


        const decrypted =
            await crypto.subtle.decrypt(

                {
                    name:
                        "AES-CBC",

                    iv:
                        ivBytes
                },

                cryptoKey,

                cipherBytes

            );


        return new TextDecoder(
            "utf-8",
            {
                fatal: true
            }
        ).decode(
            decrypted
        );

    } catch {

        return null;

    }

}


// ============================================================================
// CHECK WHETHER VALUE LOOKS ENCRYPTED
// ============================================================================

function isEncryptedString(
    value
) {

    if (
        typeof value !== "string"
    ) {

        return false;

    }


    const parts =
        value.split(":");


    if (
        parts.length !== 2
    ) {

        return false;

    }


    const cipher =
        parts[0];

    const iv =
        parts[1];


    if (
        !cipher ||
        !iv
    ) {

        return false;

    }


    const ivBytes =
        base64ToUint8Array(
            iv
        );


    if (
        !ivBytes ||
        ivBytes.length !== 16
    ) {

        return false;

    }


    return true;

}


// ============================================================================
// RECURSIVE DECRYPTION
// ============================================================================
//
// Automatically decrypts encrypted strings anywhere in the response:
//
//   data[].path
//   data[].file_link
//   data[].download_link
//   data[].backup_url
//   data[].backup_url2
//   data[].encrypted_links[].path
//   data[].download_links[].path
//   etc.
//
// Normal strings/numbers/booleans/null remain unchanged.
// ============================================================================

async function decryptObject(
    value
) {

    // ------------------------------------------------------------
    // STRING
    // ------------------------------------------------------------

    if (
        typeof value === "string"
    ) {

        if (
            !isEncryptedString(
                value
            )
        ) {

            return value;

        }


        const decrypted =
            await decrypt(
                value
            );


        // If decryption fails,
        // preserve the original value.
        if (
            decrypted === null
        ) {

            return value;

        }


        return decrypted;

    }


    // ------------------------------------------------------------
    // ARRAY
    // ------------------------------------------------------------

    if (
        Array.isArray(
            value
        )
    ) {

        const output = [];


        for (
            const item
            of value
        ) {

            output.push(
                await decryptObject(
                    item
                )
            );

        }


        return output;

    }


    // ------------------------------------------------------------
    // OBJECT
    // ------------------------------------------------------------

    if (
        value !== null &&
        typeof value === "object"
    ) {

        const output = {};


        for (
            const [
                key,
                item
            ]
            of Object.entries(
                value
            )
        ) {

            output[key] =
                await decryptObject(
                    item
                );

        }


        return output;

    }


    // ------------------------------------------------------------
    // OTHER VALUES
    // ------------------------------------------------------------

    return value;

}


// ============================================================================
// MAIN GET HANDLER
// ============================================================================

export async function onRequestGet(
    context
) {

    const request =
        context.request;


    try {

        // =====================================================================
        // 1. READ ?id=
        // =====================================================================

        const courseId =
            getCourseId(
                request
            );


        if (
            !courseId
        ) {

            return jsonResponse(

                {

                    status:
                        400,

                    error:
                        "Missing course ID.",

                    message:
                        "Use /api/live?id=COURSE_ID",

                    data:
                        []

                },

                400

            );

        }


        // =====================================================================
        // 2. FETCH TOKENS.JSON
        // =====================================================================

        const tokenResponse =
            await fetchTokens(
                request,
                context.env
            );


        // =====================================================================
        // 3. MATCH COURSE ID WITH BATCH ID
        // =====================================================================

        const account =
            findMatchingBatch(

                tokenResponse.data,

                courseId

            );


        if (
            !account
        ) {

            return jsonResponse(

                {

                    status:
                        404,

                    error:
                        "No matching batch found in tokens.json.",

                    courseId,

                    data:
                        []

                },

                404

            );

        }


        // =====================================================================
        // 4. CALL LIVE API
        // =====================================================================

        const upstream =
            await fetchLiveClasses(

                courseId,

                account

            );


        // =====================================================================
        // 5. DECRYPT UPSTREAM RESPONSE
        // =====================================================================

        const decoded =
            await decryptObject(
                upstream
            );


        // =====================================================================
        // 6. RETURN DECODED RESPONSE
        // =====================================================================
        //
        // Never return:
        //   account.userId
        //   account.token
        //
        // =====================================================================

        const response = {

            status:
                200,

            courseId,

            data:
                Array.isArray(
                    decoded.data
                )
                    ? decoded.data
                    : (
                        decoded.data ??
                        []
                    )

        };


        return jsonResponse(
            response,
            200
        );


    } catch (error) {

        // =====================================================================
        // ERROR RESPONSE
        // =====================================================================

        return jsonResponse(

            {

                status:
                    500,

                error:
                    error?.message ||
                    "Internal Server Error.",

                data:
                    []

            },

            500

        );

    }

}


// ============================================================================
// OPTIONS
// ============================================================================

export async function onRequestOptions() {

    return new Response(

        null,

        {

            status:
                204,

            headers:
                HEADERS

        }

    );

        }
