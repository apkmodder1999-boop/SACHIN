// ============================================================================
// CLOUDFLARE PAGES FUNCTION
// FILE: /functions/api/batches.js
//
// ROUTE:
//   /api/batches
//
// SOURCE:
//   /api/active?key=shivuu
//
// PURPOSE:
//   1. Call /api/active?key=shivuu
//   2. Read its response
//   3. Extract only the batch information
//   4. Remove userId and token completely
//   5. Return a clean response containing:
//
//        data: [
//          {
//            id,
//            batch_name,
//            batch_image
//          }
//        ]
//
// IMPORTANT:
//   This endpoint does NOT expose:
//     - userId
//     - token
//     - authorization
//     - account data
//     - fetch_active internal data
//
// ============================================================================


// ============================================================================
// SETTINGS
// ============================================================================

const PAGE_TIMEOUT = 15000;


// ============================================================================
// ADMIN SOURCE KEY
// ============================================================================
//
// This key is used ONLY when batches.js calls /api/active.
// ============================================================================

const ACTIVE_KEY = "shivuu";


// ============================================================================
// RESPONSE HEADERS
// ============================================================================

const HEADERS = {

    "Access-Control-Allow-Origin": "*",

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
// FETCH WITH TIMEOUT
// ============================================================================

async function fetchWithTimeout(
    url,
    options = {},
    timeout = PAGE_TIMEOUT
) {

    const controller =
        new AbortController();


    const timer =
        setTimeout(
            () => controller.abort(),
            timeout
        );


    try {

        return await fetch(

            url,

            {
                ...options,

                signal:
                    controller.signal
            }

        );

    } finally {

        clearTimeout(timer);

    }

}


// ============================================================================
// GET /api/active URL
// ============================================================================

function getActiveUrl(request) {

    const incoming =
        new URL(
            request.url
        );


    const activeUrl =
        new URL(
            "/api/active",
            incoming.origin
        );


    activeUrl.searchParams.set(
        "key",
        ACTIVE_KEY
    );


    return activeUrl.toString();

}


// ============================================================================
// FETCH ACTIVE RESPONSE
// ============================================================================

async function fetchActive(request) {

    const activeUrl =
        getActiveUrl(
            request
        );


    const response =
        await fetchWithTimeout(

            activeUrl,

            {
                method:
                    "GET",

                headers: {

                    "Accept":
                        "application/json"

                }

            }

        );


    if (!response.ok) {

        throw new Error(

            `active endpoint returned HTTP ${response.status}`

        );

    }


    let json;


    try {

        json =
            await response.json();

    } catch {

        throw new Error(
            "active endpoint returned invalid JSON."
        );

    }


    if (
        !json ||
        typeof json !== "object"
    ) {

        throw new Error(
            "Invalid active endpoint response."
        );

    }


    return json;

}


// ============================================================================
// EXTRACT ONLY BATCH FIELDS
// ============================================================================

function extractBatch(item) {

    if (
        !item ||
        typeof item !== "object"
    ) {

        return null;

    }


    // ------------------------------------------------------------------------
    // ID
    // ------------------------------------------------------------------------

    if (
        item.batch_id === undefined &&
        item.id === undefined
    ) {

        return null;

    }


    const rawId =
        item.batch_id ??
        item.id;


    if (
        rawId === null ||
        rawId === undefined
    ) {

        return null;

    }


    const id =
        String(
            rawId
        ).trim();


    if (!id) {

        return null;

    }


    // ------------------------------------------------------------------------
    // NAME
    // ------------------------------------------------------------------------

    const rawName =
        item.batch_name ??
        item.course_name ??
        item.title ??
        item.name ??
        "Course Batch";


    const batchName =
        String(
            rawName || "Course Batch"
        );


    // ------------------------------------------------------------------------
    // IMAGE
    // ------------------------------------------------------------------------

    const rawImage =
        item.batch_image ??
        item.course_thumbnail ??
        item.thumbnail ??
        item.cover ??
        item.image ??
        item.banner ??
        item.batch_thumbnail ??
        "";


    const batchImage =
        String(
            rawImage || ""
        );


    // ------------------------------------------------------------------------
    // RETURN ONLY REQUIRED FIELDS
    // ------------------------------------------------------------------------

    return {

        id,

        batch_name:
            batchName,

        batch_image:
            batchImage

    };

}


// ============================================================================
// REMOVE DUPLICATES
// ============================================================================

function cleanBatches(sourceData) {

    if (
        !Array.isArray(
            sourceData
        )
    ) {

        return [];

    }


    const batchMap =
        new Map();


    for (
        const item
        of sourceData
    ) {

        const batch =
            extractBatch(
                item
            );


        if (!batch) {

            continue;

        }


        // Keep first occurrence of each ID.
        if (
            batchMap.has(
                batch.id
            )
        ) {

            continue;

        }


        batchMap.set(
            batch.id,
            batch
        );

    }


    return Array.from(
        batchMap.values()
    );

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
        // FETCH /api/active?key=shivuu
        // =====================================================================

        const activeResponse =
            await fetchActive(
                request
            );


        // =====================================================================
        // MAKE SURE ACTIVE ENDPOINT RETURNED DATA[]
        // =====================================================================

        const sourceData =
            Array.isArray(
                activeResponse.data
            )

                ? activeResponse.data

                : [];


        // =====================================================================
        // CLEAN DATA
        // =====================================================================

        const data =
            cleanBatches(
                sourceData
            );


        // =====================================================================
        // FINAL CLEAN RESPONSE
        // =====================================================================
        //
        // Exactly the useful batch data is exposed here.
        //
        // No:
        //   userId
        //   token
        //   authorization
        //   account
        // =====================================================================

        const response = {

            status:
                200,

            message:
                `Fetched ${data.length} unique batches.`,

            count:
                data.length,

            data

        };


        return new Response(

            JSON.stringify(

                response,

                null,
                4

            ),

            {
                status:
                    200,

                headers:
                    HEADERS
            }

        );

    } catch (error) {

        // =====================================================================
        // ERROR
        // =====================================================================

        return new Response(

            JSON.stringify(

                {
                    status:
                        500,

                    error:
                        error?.message ||
                        "Internal Server Error.",

                    data:
                        []
                },

                null,
                4

            ),

            {
                status:
                    500,

                headers:
                    HEADERS
            }

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
