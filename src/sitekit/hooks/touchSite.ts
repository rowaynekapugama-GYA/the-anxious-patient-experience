import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/**
 * Records that something changed, so the Dashboard can show the
 * "changes waiting to publish" notice.
 */
async function touch(req: { payload: { updateGlobal: Function } }) {
  try {
    await req.payload.updateGlobal({
      slug: 'site-status',
      data: { lastChangedAt: new Date().toISOString() },
      depth: 0,
    })
  } catch {
    // never let bookkeeping stop a save
  }
}

export const touchSite: CollectionAfterChangeHook & CollectionAfterDeleteHook = async ({ req }) => {
  await touch(req as never)
}

export const touchSiteGlobal: GlobalAfterChangeHook = async ({ req, doc, context }) => {
  // a setting that applies without publishing (v1.8.3 release update) does not ask for a publish
  if ((context as { noPublishNeeded?: boolean } | undefined)?.noPublishNeeded) return doc
  await touch(req as never)
  return doc
}
