// ============================================================================
// CLOUDFLARE PAGES FUNCTION
// FILE: /functions/api/classes.js
//
// ROUTE:
//
//   /api/classes?id=8&subjectid=24&conceptid=
//
// OPTIONAL:
//
//   /api/classes?id=8&subjectid=24&conceptid=&topicid=1
//
// EXAMPLE:
//
//   /api/classes?id=8&subjectid=24&conceptid=
//
// TOKEN SOURCE:
//
//   /tokens.json
//
// UPSTREAM:
//
//   https://sachinacademyapi.classx.co.in/get/
//   livecourseclassbycoursesubtopconceptapiv3
//
// UPSTREAM PARAMETERS:
//
//   courseid=8
//   subjectid=24
//   topicid=1
//   conceptid=
//   windowsapp=false
//   start=0
//
// AUTHENTICATION FLOW:
//
//   /api/classes
//          |
//          v
//   /tokens.json
//          |
//          v
//   Match batch_id with course id
//          |
//          v
//   Get matching userId + token
//          |
//          v
//   Call ClassX classes API
//          |
//          v
//   Decrypt encrypted response values
//          |
//          v
//   Return decoded response
//
// SECURITY:
//
//   - No hardcoded ClassX token
//   - No hardcoded user ID
//   - Token is used only server-side
//   - Token and userId are NOT returned
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

const CLASSES_API =
    "https://sachinacademyapi.classx.co.in/get/livecourseclassbycoursesubtopconceptapiv3";

// AES key supplied for the encrypted response.
const DECRYPTION_KEY =
    "638udh3829162018";

// Default topic ID because the endpoint requires topicid.
// Pass ?topicid=... to override it.
const DEFAULT_TOPIC_ID = "1";


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
// JSON RESPONSE
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
// READ QUERY PARAMETER
// ============================================================================

function getParam(
    request,
    name,
    defaultValue = ""
) {

    const url =
        new URL(
            request.url
        );

    const value =
        url.searchParams.get(
            name
        );

    if (
        value === null ||
        value === undefined
    ) {

        return defaultValue;

    }

    return String(
        value
    ).trim();

}


// ============================================================================
// GET COURSE ID
// ============================================================================

function getCourseId(
    request
) {

    return getParam(
        request,
        "id"
    );

}


// ============================================================================
// GET SUBJECT ID
// ============================================================================

function getSubjectId(
    request
) {

    return getParam(
        request,
        "subjectid"
    );

}


// ============================================================================
// GET CONCEPT ID
// ============================================================================

function getConceptId(
    request
) {

    return getParam(
        request,
        "conceptid"
    );

}


// ============================================================================
// GET TOPIC ID
// ============================================================================

function getTopicId(
    request
) {

    return getParam(
        request,
        "topicid",
        DEFAULT_TOPIC_ID
    );

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


    if (
        !response.ok
    ) {

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
// FIND MATCHING ACCOUNT
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
// BUILD CLASSES API URL
// ============================================================================

function buildClassesUrl(
    courseId,
    subjectId,
    topicId,
    conceptId
) {

    const url =
        new URL(
            CLASSES_API
        );


    url.searchParams.set(
        "courseid",
        courseId
    );


    url.searchParams.set(
        "subjectid",
        subjectId
    );


    url.searchParams.set(
        "topicid",
        topicId
    );


    url.searchParams.set(
        "conceptid",
        conceptId
    );


    url.searchParams.set(
        "windowsapp",
        "false"
    );


    url.searchParams.set(
        "start",
        "0"
    );


    return url.toString();

}


// ============================================================================
// FETCH CLASSES
// ============================================================================

async function fetchClasses(
    courseId,
    subjectId,
    topicId,
    conceptId,
    account
) {

    const classesUrl =
        buildClassesUrl(

            courseId,
            subjectId,
            topicId,
            conceptId

        );


    const response =
        await fetch(

            classesUrl,

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
            `Classes API returned HTTP ${response.status}`
        );

    }


    let json;


    try {

        json =
            await response.json();

    } catch {

        throw new Error(
            "Classes API returned invalid JSON."
        );

    }


    if (
        !json ||
        typeof json !== "object"
    ) {

        throw new Error(
            "Invalid Classes API response."
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
// AES-CBC / PKCS7 DECRYPTION
// ============================================================================
//
// Equivalent to:
//
// function decrypt(enc) {
//     try {
//         const [cipher, iv] = enc.split(":");
//         const key = CryptoJS.enc.Utf8.parse("638udh3829162018");
//         const decrypted = CryptoJS.AES.decrypt(
//             { ciphertext: CryptoJS.enc.Base64.parse(cipher) },
//             key,
//             {
//                 iv: CryptoJS.enc.Base64.parse(iv),
//                 mode: CryptoJS.mode.CBC,
//                 padding: CryptoJS.pad.Pkcs7
//             }
//         );
//         return CryptoJS.enc.Utf8.stringify(decrypted);
//     } catch (e) {
//         return null;
//     }
// }
//
// Cloudflare's Web Crypto API is used here instead of CryptoJS.
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


        // AES-CBC requires a 16-byte IV.
        if (
            ivBytes.length !== 16
        ) {

            return null;

        }


        const keyBytes =
            new TextEncoder().encode(
                DECRYPTION_KEY
            );


        // 638udh3829162018 = 16 bytes.
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
// CHECK WHETHER A STRING IS AN ENCRYPTED VALUE
// ============================================================================
//
// Expected format:
//
//   cipherBase64:ivBase64
//
// The IV must decode to exactly 16 bytes.
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


    // Also make sure the cipher is valid Base64.
    const cipherBytes =
        base64ToUint8Array(
            cipher
        );


    if (
        !cipherBytes ||
        cipherBytes.length === 0
    ) {

        return false;

    }


    return true;

}


// ============================================================================
// RECURSIVE DECRYPTION
// ============================================================================
//
// This walks through the complete Classes API response.
//
// It can decrypt encrypted values at any depth:
//
//   data[].path
//   data[].file_link
//   data[].download_link
//   data[].backup_url
//   data[].backup_url2
//   data[].encrypted_links[].path
//   data[].download_links[].path
//   data[].pdf_encryption_key
//   nested objects
//   nested arrays
//
// Normal strings remain unchanged.
// Numbers, booleans and null remain unchanged.
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


        // If it is not decryptable,
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
    // OTHER TYPES
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
        // 1. READ PARAMETERS
        // =====================================================================

        const courseId =
            getCourseId(
                request
            );


        const subjectId =
            getSubjectId(
                request
            );


        const conceptId =
            getConceptId(
                request
            );


        const topicId =
            getTopicId(
                request
            );


        // =====================================================================
        // 2. VALIDATE COURSE ID
        // =====================================================================

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
                        "Use /api/classes?id=COURSE_ID&subjectid=SUBJECT_ID&conceptid=CONCEPT_ID",

                    data:
                        []

                },

                400

            );

        }


        // =====================================================================
        // 3. VALIDATE SUBJECT ID
        // =====================================================================

        if (
            !subjectId
        ) {

            return jsonResponse(

                {

                    status:
                        400,

                    error:
                        "Missing subject ID.",

                    courseId,

                    data:
                        []

                },

                400

            );

        }


        // =====================================================================
        // 4. FETCH TOKENS.JSON
        // =====================================================================

        const tokenResponse =
            await fetchTokens(
                request,
                context.env
            );


        // =====================================================================
        // 5. FIND MATCHING ACCOUNT
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

                    subjectId,

                    topicId,

                    conceptId,

                    data:
                        []

                },

                404

            );

        }


        // =====================================================================
        // 6. CALL CLASSES API
        // =====================================================================

        const upstream =
            await fetchClasses(

                courseId,

                subjectId,

                topicId,

                conceptId,

                account

            );


        // =====================================================================
        // 7. DECRYPT COMPLETE UPSTREAM RESPONSE
        // =====================================================================

        const decoded =
            await decryptObject(
                upstream
            );


        // =====================================================================
        // 8. RETURN DECODED RESPONSE
        // =====================================================================
        //
        // userId and token are never returned.
        //
        // =====================================================================

        const response = {

            status:
                200,

            courseId,

            subjectId,

            topicId,

            conceptId,

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


    } catch (
        error
    ) {

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
