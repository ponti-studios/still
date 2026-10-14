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
}

@objc(CachedContainer)
public final class CachedContainer: NSManagedObject {
  @NSManaged public var id: String
  @NSManaged public var name: String
  @NSManaged public var containerType: String?
  @NSManaged public var parentContainerId: String?
  @NSManaged public var desc: String?
  @NSManaged public var metadata: String
}

@objc(CachedCollection)
public final class CachedCollection: NSManagedObject {
  @NSManaged public var id: String
  @NSManaged public var name: String
  @NSManaged public var desc: String?
}

@objc(CachedMembership)
public final class CachedMembership: NSManagedObject {
  @NSManaged public var collectionId: String
  @NSManaged public var entityId: String
}

enum StillLibraryModel {
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

/// The library cache. Every access runs inside `performAndWait`, so sharing it across
/// threads is safe; the model is versioned for the stage-2 Mac sharing.
public final class StillLibraryStore: @unchecked Sendable {
  private let container: NSPersistentContainer

  /// File-backed in Application Support, falling back to in-memory when the file
  /// store cannot load: a cache must never break the app.
  public init(inMemory: Bool = false) {
    if let container = Self.makeContainer(inMemory: inMemory) {
      self.container = container
    } else if let memory = Self.makeContainer(inMemory: true) {
      container = memory
    } else {
      fatalError("Core Data unavailable")
    }
    container.viewContext.automaticallyMergesChangesFromParent = true
  }

  private static func makeContainer(inMemory: Bool) -> NSPersistentContainer? {
    let container = NSPersistentContainer(
      name: "StillLibrary", managedObjectModel: StillLibraryModel.make())
    if inMemory {
      let description = NSPersistentStoreDescription()
      description.type = NSInMemoryStoreType
      container.persistentStoreDescriptions = [description]
    } else {
      guard
        let base = try? FileManager.default.url(
          for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      else { return nil }
      let folder = base.appendingPathComponent("Still", isDirectory: true)
      try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      container.persistentStoreDescriptions = [
        NSPersistentStoreDescription(url: folder.appendingPathComponent("StillLibrary.sqlite")),
      ]
    }
    var loaded = false
    container.loadPersistentStores { _, error in loaded = error == nil }
    return loaded ? container : nil
  }

  /// The payload shape, with empty lists: what reads resolve before the first sync.
  public static let emptyPayload: [String: Any] = [
    "possessions": [], "containers": [], "collections": [], "membership": [:] as [String: [String]],
  ]

  /// Replaces the whole cache with fresh API JSON. Volumes are small; wipe-and-fill
  /// cannot leave a deleted row behind.
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
      }
      for json in containers {
        let row = CachedContainer(context: background)
        row.id = json.string("id") ?? ""
        row.name = json.string("name") ?? ""
        row.containerType = json.string("containerType")
        row.parentContainerId = json.string("parentContainerId")
        row.desc = json.string("description")
        row.metadata = json.text("metadata")
      }
      for json in collections {
        let row = CachedCollection(context: background)
        row.id = json.string("id") ?? ""
        row.name = json.string("name") ?? ""
        row.desc = json.string("description")
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
  /// membership as possession id to collection ids. No network.
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
      var membership: [String: [String]] = [:]
      for link in links {
        membership[link.entityId, default: []].append(link.collectionId)
      }
      return [
        "possessions": possessions.map {
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
          ] as [String: Any]
        },
        "containers": containers.map {
          [
            "id": $0.id, "name": $0.name,
            "containerType": $0.containerType ?? NSNull(),
            "parentContainerId": $0.parentContainerId ?? NSNull(),
            "description": $0.desc ?? NSNull(),
            "metadata": $0.metadataObject,
          ] as [String: Any]
        },
        "collections": collections.map {
          ["id": $0.id, "name": $0.name, "description": $0.desc ?? NSNull()] as [String: Any]
        },
        "membership": membership,
      ]
    }
  }

  /// Wipes the cache, e.g. on sign-out, so one person's library never shows to the next.
  public func clear() {
    let background = container.newBackgroundContext()
    background.performAndWait {
      Self.wipe(background)
      _ = try? background.save()
    }
  }

  /// Deletes every cached row. Fetch-and-delete, not batch: batch requests only
  /// work on SQLite stores, and tests run in memory.
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
