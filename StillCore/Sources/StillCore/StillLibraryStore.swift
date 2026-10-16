import CoreData
import Foundation

// The on-device library cache: Hominem stays the source of truth, these rows are a
// read-through copy. Wipe-and-fill on every sync, so the cache cannot go stale.

@objc(CachedPossession)
public final class CachedPossession: NSManagedObject {
  @NSManaged public var id: String
  @NSManaged public var name: String
  @NSManaged public var category: String?
  @NSManaged public var status: String?
  @NSManaged public var isArchived: Bool
  @NSManaged public var acquiredDate: String?
  @NSManaged public var priceCents: Int64
  @NSManaged public var currencyCode: String?
  @NSManaged public var containerId: String?
  @NSManaged public var metadata: String
  @NSManaged public var createdAt: String
  // still-library-2 additions. Artist, daily cost, amount and provenance ride
  // in `metadata` until the stage-2 model convergence gives them columns.
  @NSManaged public var brand: String?
  @NSManaged public var model: String?
  @NSManaged public var subCategory: String?
  @NSManaged public var url: String?
  @NSManaged public var notes: String?
  @NSManaged public var serialNumber: String?
  @NSManaged public var size: String?
  @NSManaged public var color: String?
  @NSManaged public var placement: String?
  @NSManaged public var categoryId: String?
  @NSManaged public var retiredDate: String?
  @NSManaged public var sellPriceCents: Int64
  @NSManaged public var updatedAt: String?
  @NSManaged public var deletedAt: String?
}

@objc(CachedContainer)
public final class CachedContainer: NSManagedObject {
  @NSManaged public var id: String
  @NSManaged public var name: String
  @NSManaged public var containerType: String?
  @NSManaged public var parentContainerId: String?
  @NSManaged public var desc: String?
  @NSManaged public var metadata: String
  @NSManaged public var updatedAt: String?
  @NSManaged public var deletedAt: String?
}

@objc(CachedCollection)
public final class CachedCollection: NSManagedObject {
  @NSManaged public var id: String
  @NSManaged public var name: String
  @NSManaged public var desc: String?
  @NSManaged public var updatedAt: String?
  @NSManaged public var deletedAt: String?
}

@objc(CachedMembership)
public final class CachedMembership: NSManagedObject {
  @NSManaged public var collectionId: String
  @NSManaged public var entityId: String
}

/// Managed categories (stage-2 convergence fills these; empty until then).
@objc(CachedCategory)
public final class CachedCategory: NSManagedObject {
  @NSManaged public var id: String
  @NSManaged public var name: String
}

/// Ordered photo manifest. Bytes live in iCloud; Hominem carries this index.
/// `sha256` (not `hash`: `NSObject.hash` collides) names the immutable file.
@objc(CachedImageAsset)
public final class CachedImageAsset: NSManagedObject {
  @NSManaged public var id: String
  @NSManaged public var possessionId: String
  @NSManaged public var sha256: String?
  @NSManaged public var filename: String?
  @NSManaged public var displayOrder: Int64
  @NSManaged public var altText: String?
  @NSManaged public var originalFilename: String?
}

/// A photo manifest entry crossing the store boundary. Value type, so the
/// React Native bridge and the photo sync pass it without touching Core Data.
public struct CachedImageAssetInput: Sendable, Equatable {
  public var id: String
  public var possessionId: String
  public var sha256: String?
  public var filename: String?
  public var displayOrder: Int64
  public var altText: String?
  public var originalFilename: String?

  public init(
    id: String, possessionId: String, sha256: String? = nil, filename: String? = nil,
    displayOrder: Int64 = 0, altText: String? = nil, originalFilename: String? = nil
  ) {
    self.id = id
    self.possessionId = possessionId
    self.sha256 = sha256
    self.filename = filename
    self.displayOrder = displayOrder
    self.altText = altText
    self.originalFilename = originalFilename
  }
}
/// The shipped v1 model, frozen. Do not edit: the migrator diffs real user
/// stores against exactly this shape, and `StillLibraryModelTests` enforces it.
enum StillLibraryModelV1 {
  static func make() -> NSManagedObjectModel {
    func attribute(
      _ name: String, _ type: NSAttributeType, optional: Bool = true, defaultValue: Any? = nil
    ) -> NSAttributeDescription {
      let attribute = NSAttributeDescription()
      attribute.name = name
      attribute.attributeType = type
      attribute.isOptional = optional
      attribute.defaultValue = defaultValue
      return attribute
    }
    func entity(_ name: String, class: AnyClass, _ attributes: NSAttributeDescription...) -> NSEntityDescription {
      let entity = NSEntityDescription()
      entity.name = name
      entity.managedObjectClassName = NSStringFromClass(`class`)
      entity.properties = attributes
      return entity
    }
    let string = NSAttributeType.stringAttributeType
    let int = NSAttributeType.integer64AttributeType
    let bool = NSAttributeType.booleanAttributeType
    let model = NSManagedObjectModel()
    model.entities = [
      entity(
        "CachedPossession", class: CachedPossession.self,
        attribute("id", string, optional: false),
        attribute("name", string, optional: false),
        attribute("category", string),
        attribute("status", string),
        attribute("isArchived", bool, optional: false, defaultValue: false),
        attribute("acquiredDate", string),
        attribute("priceCents", int, optional: false, defaultValue: 0),
        attribute("currencyCode", string),
        attribute("containerId", string),
        attribute("metadata", string, optional: false, defaultValue: "{}"),
        attribute("createdAt", string, optional: false, defaultValue: "")),
      entity(
        "CachedContainer", class: CachedContainer.self,
        attribute("id", string, optional: false),
        attribute("name", string, optional: false),
        attribute("containerType", string),
        attribute("parentContainerId", string),
        attribute("desc", string),
        attribute("metadata", string, optional: false, defaultValue: "{}")),
      entity(
        "CachedCollection", class: CachedCollection.self,
        attribute("id", string, optional: false),
        attribute("name", string, optional: false),
        attribute("desc", string)),
      entity(
        "CachedMembership", class: CachedMembership.self,
        attribute("collectionId", string, optional: false),
        attribute("entityId", string, optional: false)),
    ]
    model.versionIdentifiers = ["still-library-1"]
    return model
  }
}

/// The stage-2 shared model: v1 plus rich possession fields, sync bookkeeping
/// (`updatedAt`/`deletedAt` tombstones on every collection-side entity),
/// managed categories, and the photo manifest. Every change from v1 is
/// additive (new optional attributes with defaults, new entities), so the
/// migrator infers the mapping.
enum StillLibraryModelV2 {
  static func make() -> NSManagedObjectModel {
    func attribute(
      _ name: String, _ type: NSAttributeType, optional: Bool = true, defaultValue: Any? = nil
    ) -> NSAttributeDescription {
      let attribute = NSAttributeDescription()
      attribute.name = name
      attribute.attributeType = type
      attribute.isOptional = optional
      attribute.defaultValue = defaultValue
      return attribute
    }
    func entity(_ name: String, class: AnyClass, _ attributes: NSAttributeDescription...) -> NSEntityDescription {
      let entity = NSEntityDescription()
      entity.name = name
      entity.managedObjectClassName = NSStringFromClass(`class`)
      entity.properties = attributes
      return entity
    }
    let string = NSAttributeType.stringAttributeType
    let int = NSAttributeType.integer64AttributeType
    let bool = NSAttributeType.booleanAttributeType
    let model = NSManagedObjectModel()
    model.entities = [
      entity(
        "CachedPossession", class: CachedPossession.self,
        attribute("id", string, optional: false),
        attribute("name", string, optional: false),
        attribute("category", string),
        attribute("status", string),
        attribute("isArchived", bool, optional: false, defaultValue: false),
        attribute("acquiredDate", string),
        attribute("priceCents", int, optional: false, defaultValue: 0),
        attribute("currencyCode", string),
        attribute("containerId", string),
        attribute("metadata", string, optional: false, defaultValue: "{}"),
        attribute("createdAt", string, optional: false, defaultValue: ""),
        attribute("brand", string),
        attribute("model", string),
        attribute("subCategory", string),
        attribute("url", string),
        attribute("notes", string),
        attribute("serialNumber", string),
        attribute("size", string),
        attribute("color", string),
        attribute("placement", string),
        attribute("categoryId", string),
        attribute("retiredDate", string),
        attribute("sellPriceCents", int, optional: false, defaultValue: 0),
        attribute("updatedAt", string),
        attribute("deletedAt", string)),
      entity(
        "CachedContainer", class: CachedContainer.self,
        attribute("id", string, optional: false),
        attribute("name", string, optional: false),
        attribute("containerType", string),
        attribute("parentContainerId", string),
        attribute("desc", string),
        attribute("metadata", string, optional: false, defaultValue: "{}"),
        attribute("updatedAt", string),
        attribute("deletedAt", string)),
      entity(
        "CachedCollection", class: CachedCollection.self,
        attribute("id", string, optional: false),
        attribute("name", string, optional: false),
        attribute("desc", string),
        attribute("updatedAt", string),
        attribute("deletedAt", string)),
      entity(
        "CachedMembership", class: CachedMembership.self,
        attribute("collectionId", string, optional: false),
        attribute("entityId", string, optional: false)),
      entity(
        "CachedCategory", class: CachedCategory.self,
        attribute("id", string, optional: false),
        attribute("name", string, optional: false)),
      entity(
        "CachedImageAsset", class: CachedImageAsset.self,
        attribute("id", string, optional: false),
        attribute("possessionId", string, optional: false),
        attribute("sha256", string),
        attribute("filename", string),
        attribute("displayOrder", int, optional: false, defaultValue: 0),
        attribute("altText", string),
        attribute("originalFilename", string)),
    ]
    model.versionIdentifiers = ["still-library-2"]
    return model
  }
}

/// The library cache. Every access runs inside `performAndWait`, so sharing it across
/// threads is safe; the model is versioned for the stage-2 Mac sharing.
public final class StillLibraryStore: @unchecked Sendable {
  private let container: NSPersistentContainer

  /// File-backed in Application Support, falling back to in-memory when the file
  /// store cannot load: a cache must never break the app.
  /// `storeURL` is a test seam (a temp-dir file, usually); nil means the default location.
  public init(inMemory: Bool = false, storeURL: URL? = nil) {
    if let container = Self.makeContainer(inMemory: inMemory, storeURL: storeURL) {
      self.container = container
    } else if let memory = Self.makeContainer(inMemory: true, storeURL: nil) {
      container = memory
    } else {
      fatalError("Core Data unavailable")
    }
    container.viewContext.automaticallyMergesChangesFromParent = true
  }

  private static func defaultStoreURL() -> URL? {
    guard
      let base = try? FileManager.default.url(
        for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    else { return nil }
    let folder = base.appendingPathComponent("Still", isDirectory: true)
    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder.appendingPathComponent("StillLibrary.sqlite")
  }

  private static func makeContainer(inMemory: Bool, storeURL: URL?) -> NSPersistentContainer? {
    if inMemory {
      let container = NSPersistentContainer(
        name: "StillLibrary", managedObjectModel: StillLibraryModelV2.make())
      let description = NSPersistentStoreDescription()
      description.type = NSInMemoryStoreType
      container.persistentStoreDescriptions = [description]
      return load(container)
    }
    let url: URL
    if let storeURL {
      try? FileManager.default.createDirectory(
        at: storeURL.deletingLastPathComponent(), withIntermediateDirectories: true)
      url = storeURL
    } else {
      guard let `default` = defaultStoreURL() else { return nil }
      url = `default`
    }
    if !FileManager.default.fileExists(atPath: url.path) {
      return freshFileContainer(at: url)
    }
    if isCompatible(model: StillLibraryModelV2.make(), storeURL: url) {
      return freshFileContainer(at: url)
    }
    if isCompatible(model: StillLibraryModelV1.make(), storeURL: url) {
      guard migrateV1ToV2(storeURL: url) else { return nil }
      return freshFileContainer(at: url)
    }
    // Unknown version or unreadable store: the cache is derived data, so wipe
    // it and start over rather than stranding the user. The next sync refills.
    destroyStore(at: url)
    return freshFileContainer(at: url)
  }

  /// A v2 file container. The automatic-migration options are set (harmless,
  /// future-proof), but programmatic models are not discoverable in bundles,
  /// so the explicit `migrateV1ToV2` above is the authoritative path.
  private static func freshFileContainer(at url: URL) -> NSPersistentContainer? {
    let container = NSPersistentContainer(
      name: "StillLibrary", managedObjectModel: StillLibraryModelV2.make())
    let description = NSPersistentStoreDescription(url: url)
    description.setOption(true as NSNumber, forKey: NSMigratePersistentStoresAutomaticallyOption)
    description.setOption(true as NSNumber, forKey: NSInferMappingModelAutomaticallyOption)
    container.persistentStoreDescriptions = [description]
    return load(container)
  }

  private static func load(_ container: NSPersistentContainer) -> NSPersistentContainer? {
    var loaded = false
    container.loadPersistentStores { _, error in loaded = error == nil }
    return loaded ? container : nil
  }

  private static func isCompatible(model: NSManagedObjectModel, storeURL: URL) -> Bool {
    guard
      let metadata = try? NSPersistentStoreCoordinator.metadataForPersistentStore(
        ofType: NSSQLiteStoreType, at: storeURL)
    else { return false }
    return model.isConfiguration(withName: nil, compatibleWithStoreMetadata: metadata)
  }

  /// Moves a v1 store to v2 with an inferred mapping (every v1→v2 change is
  /// additive, so Core Data migrates the SQLite file in place via SQL).
  /// Returns false on any failure; the caller falls back, never crashes.
  private static func migrateV1ToV2(storeURL: URL) -> Bool {
    guard
      let mapping = try? NSMappingModel.inferredMappingModel(
        forSourceModel: StillLibraryModelV1.make(),
        destinationModel: StillLibraryModelV2.make())
    else { return false }
    let manager = NSMigrationManager(
      sourceModel: StillLibraryModelV1.make(),
      destinationModel: StillLibraryModelV2.make())
    let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    do {
      try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
      let tempURL = tempDir.appendingPathComponent(storeURL.lastPathComponent)
      try manager.migrateStore(
        from: storeURL, sourceType: NSSQLiteStoreType, options: nil,
        with: mapping, toDestinationURL: tempURL,
        destinationType: NSSQLiteStoreType, destinationOptions: nil)
      for suffix in ["", "-wal", "-shm"] {
        let original = URL(fileURLWithPath: storeURL.path + suffix)
        try? FileManager.default.removeItem(at: original)
        let migrated = URL(fileURLWithPath: tempURL.path + suffix)
        if FileManager.default.fileExists(atPath: migrated.path) {
          try FileManager.default.moveItem(at: migrated, to: original)
        }
      }
      try? FileManager.default.removeItem(at: tempDir)
      return true
    } catch {
      try? FileManager.default.removeItem(at: tempDir)
      return false
    }
  }

  private static func destroyStore(at url: URL) {
    for suffix in ["", "-wal", "-shm"] {
      try? FileManager.default.removeItem(at: URL(fileURLWithPath: url.path + suffix))
    }
  }

  /// The payload shape, with empty lists: what reads resolve before the first sync.
  public static let emptyPayload: [String: Any] = [
    "possessions": [], "containers": [], "collections": [],
    "membership": [:] as [String: [String]], "categories": [],
  ]

  /// Replaces the whole cache with fresh API JSON. Volumes are small; wipe-and-fill
  /// cannot leave a deleted row behind. Photo manifest and categories have their
  /// own lifecycle (see `replaceImageManifest`): this leaves them untouched.
  public func replaceAll(
    possessions: [[String: Any]], containers: [[String: Any]], collections: [[String: Any]],
    membership: [(collectionId: String, entityId: String)]
  ) {
    let background = container.newBackgroundContext()
    background.performAndWait {
      Self.wipe(background)
      for json in possessions {
        let row = CachedPossession(context: background)
        row.id = json.string("id") ?? ""
        row.name = json.string("name") ?? ""
        row.category = json.string("category")
        row.status = json.string("status")
        row.isArchived = json.bool("isArchived")
        row.acquiredDate = json.string("acquiredDate")
        row.priceCents = json.int("priceCents")
        row.currencyCode = json.string("currencyCode")
        row.containerId = json.string("containerId")
        row.metadata = json.text("metadata")
        row.createdAt = json.string("createdAt") ?? ""
        row.brand = json.string("brand")
        row.model = json.string("model")
        row.subCategory = json.string("subCategory")
        row.url = json.string("url")
        row.notes = json.string("notes")
        row.serialNumber = json.string("serialNumber")
        row.size = json.string("size")
        row.color = json.string("color")
        row.placement = json.string("placement")
        row.categoryId = json.string("categoryId")
        row.retiredDate = json.string("retiredDate")
        row.sellPriceCents = json.int("sellPriceCents")
        row.updatedAt = json.string("updatedAt")
        row.deletedAt = json.string("deletedAt")
      }
      for json in containers {
        let row = CachedContainer(context: background)
        row.id = json.string("id") ?? ""
        row.name = json.string("name") ?? ""
        row.containerType = json.string("containerType")
        row.parentContainerId = json.string("parentContainerId")
        row.desc = json.string("description")
        row.metadata = json.text("metadata")
        row.updatedAt = json.string("updatedAt")
        row.deletedAt = json.string("deletedAt")
      }
      for json in collections {
        let row = CachedCollection(context: background)
        row.id = json.string("id") ?? ""
        row.name = json.string("name") ?? ""
        row.desc = json.string("description")
        row.updatedAt = json.string("updatedAt")
        row.deletedAt = json.string("deletedAt")
      }
      for link in membership {
        let row = CachedMembership(context: background)
        row.collectionId = link.collectionId
        row.entityId = link.entityId
      }
      _ = try? background.save()
    }
  }

  /// The cache as API-shaped JSON: possessions, containers, collections, and
  /// membership as possession id to collection ids. No network. Tombstoned
  /// rows (`deletedAt` set) are hidden here but stay in the store for the
  /// outbox to reference. New keys are additive: the React Native screens
  /// ignore what they do not know.
  public func readPayload() -> [String: Any] {
    container.viewContext.performAndWait {
      let possessions: [CachedPossession] = (try? container.viewContext.fetch(
        NSFetchRequest<CachedPossession>(entityName: "CachedPossession"))) ?? []
      let containers: [CachedContainer] = (try? container.viewContext.fetch(
        NSFetchRequest<CachedContainer>(entityName: "CachedContainer"))) ?? []
      let collections: [CachedCollection] = (try? container.viewContext.fetch(
        NSFetchRequest<CachedCollection>(entityName: "CachedCollection"))) ?? []
      let links: [CachedMembership] = (try? container.viewContext.fetch(
        NSFetchRequest<CachedMembership>(entityName: "CachedMembership"))) ?? []
      let categories: [CachedCategory] = (try? container.viewContext.fetch(
        NSFetchRequest<CachedCategory>(entityName: "CachedCategory"))) ?? []
      var membership: [String: [String]] = [:]
      for link in links {
        membership[link.entityId, default: []].append(link.collectionId)
      }
      return [
        "possessions": possessions.filter { $0.deletedAt == nil }.map {
          [
            "id": $0.id, "name": $0.name,
            "category": $0.category ?? NSNull(),
            "status": $0.status ?? NSNull(),
            "isArchived": $0.isArchived,
            "acquiredDate": $0.acquiredDate ?? NSNull(),
            "priceCents": $0.priceCents,
            "currencyCode": $0.currencyCode ?? NSNull(),
            "containerId": $0.containerId ?? NSNull(),
            "metadata": $0.metadataObject,
            "createdAt": $0.createdAt,
            "brand": $0.brand ?? NSNull(),
            "model": $0.model ?? NSNull(),
            "subCategory": $0.subCategory ?? NSNull(),
            "url": $0.url ?? NSNull(),
            "notes": $0.notes ?? NSNull(),
            "serialNumber": $0.serialNumber ?? NSNull(),
            "size": $0.size ?? NSNull(),
            "color": $0.color ?? NSNull(),
            "placement": $0.placement ?? NSNull(),
            "categoryId": $0.categoryId ?? NSNull(),
            "retiredDate": $0.retiredDate ?? NSNull(),
            "sellPriceCents": $0.sellPriceCents,
            "updatedAt": $0.updatedAt ?? NSNull(),
          ] as [String: Any]
        },
        "containers": containers.filter { $0.deletedAt == nil }.map {
          [
            "id": $0.id, "name": $0.name,
            "containerType": $0.containerType ?? NSNull(),
            "parentContainerId": $0.parentContainerId ?? NSNull(),
            "description": $0.desc ?? NSNull(),
            "metadata": $0.metadataObject,
            "updatedAt": $0.updatedAt ?? NSNull(),
          ] as [String: Any]
        },
        "collections": collections.filter { $0.deletedAt == nil }.map {
          [
            "id": $0.id, "name": $0.name, "description": $0.desc ?? NSNull(),
            "updatedAt": $0.updatedAt ?? NSNull(),
          ] as [String: Any]
        },
        "membership": membership,
        "categories": categories.map { ["id": $0.id, "name": $0.name] },
      ]
    }
  }

  /// Replaces the managed-category table. Categories arrive via the stage-2
  /// convergence, not the library sync, hence the separate lifecycle.
  public func replaceCategories(_ categories: [(id: String, name: String)]) {
    let background = container.newBackgroundContext()
    background.performAndWait {
      let fetch = NSFetchRequest<NSManagedObject>(entityName: "CachedCategory")
      fetch.includesPropertyValues = false
      for object in (try? background.fetch(fetch)) ?? [] {
        background.delete(object)
      }
      for category in categories {
        let row = CachedCategory(context: background)
        row.id = category.id
        row.name = category.name
      }
      _ = try? background.save()
    }
  }

  /// Replaces the photo manifest. Bytes live in iCloud; this table is the
  /// Hominem-carried index. The photo sync refills it atomically with each
  /// sync, so `replaceAll` never touches these rows.
  public func replaceImageManifest(_ assets: [CachedImageAssetInput]) {
    let background = container.newBackgroundContext()
    background.performAndWait {
      let fetch = NSFetchRequest<NSManagedObject>(entityName: "CachedImageAsset")
      fetch.includesPropertyValues = false
      for object in (try? background.fetch(fetch)) ?? [] {
        background.delete(object)
      }
      for asset in assets {
        let row = CachedImageAsset(context: background)
        row.id = asset.id
        row.possessionId = asset.possessionId
        row.sha256 = asset.sha256
        row.filename = asset.filename
        row.displayOrder = asset.displayOrder
        row.altText = asset.altText
        row.originalFilename = asset.originalFilename
      }
      _ = try? background.save()
    }
  }

  /// A possession's manifest, oldest display order first. Missing files render
  /// the emoji fallback; this index never throws.
  public func imageAssets(for possessionId: String) -> [CachedImageAssetInput] {
    container.viewContext.performAndWait {
      let request = NSFetchRequest<CachedImageAsset>(entityName: "CachedImageAsset")
      request.predicate = NSPredicate(format: "possessionId == %@", possessionId)
      request.sortDescriptors = [
        NSSortDescriptor(key: "displayOrder", ascending: true),
        NSSortDescriptor(key: "id", ascending: true),
      ]
      let rows = (try? container.viewContext.fetch(request)) ?? []
      return rows.map {
        CachedImageAssetInput(
          id: $0.id, possessionId: $0.possessionId, sha256: $0.sha256,
          filename: $0.filename, displayOrder: $0.displayOrder, altText: $0.altText,
          originalFilename: $0.originalFilename)
      }
    }
  }

  /// Wipes the cache, e.g. on sign-out, so one person's library never shows to the next.
  public func clear() {
    let background = container.newBackgroundContext()
    background.performAndWait {
      Self.wipeAll(background)
      _ = try? background.save()
    }
  }

  /// Deletes every cached row, including the photo manifest and categories.
  /// Photo files on disk become orphans here; the photo sync collects them.
  private static func wipeAll(_ context: NSManagedObjectContext) {
    for name in [
      "CachedPossession", "CachedContainer", "CachedCollection", "CachedMembership",
      "CachedCategory", "CachedImageAsset",
    ] {
      let fetch = NSFetchRequest<NSManagedObject>(entityName: name)
      fetch.includesPropertyValues = false
      for object in (try? context.fetch(fetch)) ?? [] {
        context.delete(object)
      }
    }
  }

  /// Deletes the sync-owned rows. Fetch-and-delete, not batch: batch requests only
  /// work on SQLite stores, and tests run in memory. Assets and categories keep
  /// their own lifecycle and survive a sync refill.
  private static func wipe(_ context: NSManagedObjectContext) {
    for name in ["CachedPossession", "CachedContainer", "CachedCollection", "CachedMembership"] {
      let fetch = NSFetchRequest<NSManagedObject>(entityName: name)
      fetch.includesPropertyValues = false
      for object in (try? context.fetch(fetch)) ?? [] {
        context.delete(object)
      }
    }
  }
}

private extension Dictionary where Key == String {
  func string(_ key: String) -> String? { self[key] as? String }
  func bool(_ key: String) -> Bool { self[key] as? Bool ?? false }
  func int(_ key: String) -> Int64 {
    if let number = self[key] as? NSNumber { return number.int64Value }
    return 0
  }
  /// A metadata object as JSON text; anything else becomes `{}`.
  func text(_ key: String) -> String {
    guard let object = self[key], JSONSerialization.isValidJSONObject(object),
      let data = try? JSONSerialization.data(withJSONObject: object)
    else { return "{}" }
    return String(data: data, encoding: .utf8) ?? "{}"
  }
}

private extension CachedPossession {
  /// The stored metadata text back as an object; corrupt text becomes `{}`.
  var metadataObject: Any {
    guard let data = metadata.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data)
    else { return [:] as [String: Any] }
    return object
  }
}

private extension CachedContainer {
  var metadataObject: Any {
    guard let data = metadata.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data)
    else { return [:] as [String: Any] }
    return object
  }
}
