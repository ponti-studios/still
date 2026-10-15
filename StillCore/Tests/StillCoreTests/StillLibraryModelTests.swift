import CoreData
import Testing

@testable import StillCore

private func attributeNames(_ model: NSManagedObjectModel, _ entity: String) -> Set<String> {
  guard let keys = model.entitiesByName[entity]?.attributesByName.keys else { return [] }
  return Set(keys)
}

@Suite struct StillLibraryModelTests {
  @Test func v1ModelIsFrozen() {
    // The migrator diffs real user stores against exactly this shape. If this
    // test fails, someone edited v1: revert, and put the change in v3 instead.
    let model = StillLibraryModelV1.make()
    #expect(model.versionIdentifiers == ["still-library-1"])
    #expect(Set(model.entitiesByName.keys) == [
      "CachedPossession", "CachedContainer", "CachedCollection", "CachedMembership",
    ])
    #expect(
      attributeNames(model, "CachedPossession") == [
        "id", "name", "category", "status", "isArchived", "acquiredDate", "priceCents",
        "currencyCode", "containerId", "metadata", "createdAt",
      ])
    #expect(
      attributeNames(model, "CachedContainer") == [
        "id", "name", "containerType", "parentContainerId", "desc", "metadata",
      ])
    #expect(
      attributeNames(model, "CachedCollection") == ["id", "name", "desc"])
    #expect(
      attributeNames(model, "CachedMembership") == ["collectionId", "entityId"])
  }

  @Test func v2ModelInventory() {
    let model = StillLibraryModelV2.make()
    #expect(model.versionIdentifiers == ["still-library-2"])
    #expect(Set(model.entitiesByName.keys) == [
      "CachedPossession", "CachedContainer", "CachedCollection", "CachedMembership",
      "CachedCategory", "CachedImageAsset",
    ])
    let possession = attributeNames(model, "CachedPossession")
    for added in [
      "brand", "model", "subCategory", "url", "notes", "serialNumber", "size", "color",
      "placement", "categoryId", "retiredDate", "sellPriceCents", "updatedAt", "deletedAt",
    ] {
      #expect(possession.contains(added), "v2 possession is missing \(added)")
    }
    // v1 attributes survive untouched: the inferred mapping depends on it.
    for kept in [
      "id", "name", "category", "status", "isArchived", "acquiredDate", "priceCents",
      "currencyCode", "containerId", "metadata", "createdAt",
    ] {
      #expect(possession.contains(kept), "v2 possession dropped v1 attribute \(kept)")
    }
    let assets = model.entitiesByName["CachedImageAsset"]?.attributesByName
    #expect(assets?["sha256"] != nil)
    #expect(assets?["hash"] == nil, "hash collides with NSObject.hash; the attribute is sha256")
    #expect(assets?["displayOrder"]?.isOptional == false)
    #expect(
      attributeNames(model, "CachedCategory") == ["id", "name"])
  }

  @Test func v2ModelLoadsAndRoundTrips() throws {
    let container = NSPersistentContainer(
      name: "StillLibrary", managedObjectModel: StillLibraryModelV2.make())
    let description = NSPersistentStoreDescription()
    description.type = NSInMemoryStoreType
    container.persistentStoreDescriptions = [description]
    var loaded = false
    container.loadPersistentStores { _, error in loaded = error == nil }
    #expect(loaded)

    let context = container.newBackgroundContext()
    try context.performAndWait {
      let possession = CachedPossession(context: context)
      possession.id = "p1"
      possession.name = "Lamp"
      possession.brand = "Ikea"
      possession.serialNumber = "SN-1"
      possession.sellPriceCents = 500
      possession.metadata = "{}"
      possession.createdAt = "2025-01-10T00:00:00Z"
      let asset = CachedImageAsset(context: context)
      asset.id = "a1"
      asset.possessionId = "p1"
      asset.sha256 = "abc123"
      asset.displayOrder = 0
      let category = CachedCategory(context: context)
      category.id = "cat1"
      category.name = "Home"
      try context.save()
    }

    try container.viewContext.performAndWait {
      let possessions = try container.viewContext.fetch(
        NSFetchRequest<CachedPossession>(entityName: "CachedPossession"))
      #expect(possessions.count == 1)
      #expect(possessions.first?.brand == "Ikea")
      #expect(possessions.first?.sellPriceCents == 500)
      let assets = try container.viewContext.fetch(
        NSFetchRequest<CachedImageAsset>(entityName: "CachedImageAsset"))
      #expect(assets.count == 1)
      #expect(assets.first?.sha256 == "abc123")
    }
  }
}
