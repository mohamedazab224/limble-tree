import { Injectable } from "@angular/core";
import { Branch } from "../classes/Branch";
import { DragStateService } from "../singletons/drag-state.service";
import type { LimbleTreeNode, ProcessedOptions } from "./tree.service";
import { arraysAreEqual } from "../util";
import { DropZone } from "../classes/DropZone";
import { DropZoneLocation } from "../classes/DropZoneLocation";

export interface DropZoneFamily {
   /** The deepest member of the family */
   founder: DropZone;
   members: Array<DropZone>;
}

function sortFamily(memberA: DropZone, memberB: DropZone) {
   const aCoordinates = memberA.getFullInsertCoordinates();
   const bCoordinates = memberB.getFullInsertCoordinates();
   if (aCoordinates.length > bCoordinates.length) {
      return -1;
   }
   if (aCoordinates.length < bCoordinates.length) {
      return 1;
   }
   return 0;
}

@Injectable()
export class DropZoneService {
   private readonly dropZoneInventory: Array<DropZone>;
   private readonly dropZoneFamilies: Array<DropZoneFamily>;
   private visibleFamily: DropZoneFamily | null;
   private activeDropZone: DropZone | null;
   private tree: Branch<any> | undefined;
   private treeOptions: ProcessedOptions | undefined;
   private tempFamilies:
      | readonly [DropZoneFamily, DropZoneFamily | null]
      | readonly [];

   constructor(private readonly dragStateService: DragStateService) {
      this.dropZoneInventory = [];
      this.dropZoneFamilies = [];
      this.visibleFamily = null;
      this.activeDropZone = null;
      this.tempFamilies = [];
      this.setActiveDropZone(null);
   }

   public addDropZone(newDropZone: DropZone): boolean {
      if (
         this.dropZoneInventory.find((registeredZone) =>
            DropZone.dropZoneLocationsAreEqual(registeredZone, newDropZone)
         ) !== undefined
      ) {
         return false;
      }
      this.dropZoneInventory.push(newDropZone);
      return true;
   }

   /** hides all drop zones */
   public clear(): void {
      if (this.visibleFamily !== null) {
         for (const member of this.visibleFamily.members) {
            member.isVisible(false);
         }
         this.visibleFamily = null;
      }
      this.restoreFamilies();
      this.setActiveDropZone(null);
   }

   public getActiveDropZone(): DropZoneService["activeDropZone"] {
      return this.activeDropZone;
   }

   public init(tree: Branch<any>, treeOptions: ProcessedOptions): void {
      this.tree = tree;
      this.treeOptions = treeOptions;
      this.reset();
      this.assignFamilies();
   }

   /** hides all drop zones and deletes all the family assignments */
   public reset(): void {
      this.clear();
      this.dropZoneFamilies.length = 0;
   }

   /**
    * Restores the service to its initial state: hides all drop zones,
    * deletes all the family assignments, and empties the dropZoneInventory.
    */
   public restart(): void {
      this.reset();
      this.dropZoneInventory.length = 0;
   }

   public restoreFamilies(): void {
      if (this.tempFamilies.length === 2) {
         this.dropZoneFamilies.pop();
         this.dropZoneFamilies.push(this.tempFamilies[0]);
         for (const member of this.tempFamilies[0].members) {
            member.setFamily(this.tempFamilies[0]);
         }
         if (this.tempFamilies[1] !== null) {
            this.dropZoneFamilies.push(this.tempFamilies[1]);
            for (const member of this.tempFamilies[1].members) {
               member.setFamily(this.tempFamilies[1]);
            }
         }
         this.tempFamilies = [];
      }
   }

   /**
    * Shows the drop zone family of the drop zone indicated by `coordinates`.
    */
   public showDropZoneFamily(
      /** Note: this drop zone may not exist in the dropZoneInventory; we have to search the inventory based on its location */
      dropZone: DropZone,
      options: {
         joinFamilies?: boolean;
         activateLowestInsteadOfFounder?: boolean;
      } = { joinFamilies: false, activateLowestInsteadOfFounder: false }
   ): void {
      if (
         this.activeDropZone !== null &&
         DropZone.dropZoneLocationsAreEqual(this.activeDropZone, dropZone)
      ) {
         //Already showing the family with the appropriate active drop zone
         return;
      }
      if (this.visibleFamily !== null || this.activeDropZone !== null) {
         this.clear();
      }
      const target = this.dropZoneInventory.find((zone) =>
         DropZone.dropZoneLocationsAreEqual(zone, dropZone)
      );
      if (target === undefined) {
         throw new Error(
            `Could not find drop zone to show. location: ${JSON.stringify(
               dropZone.getLocation()
            )}`
         );
      }
      const family = target.getFamily();
      if (options.joinFamilies === true) {
         const location1 = dropZone.getLocation();
         const location2 = new DropZoneLocation(
            [...location1.parentCoordinates],
            location1.insertIndex + 1
         );
         const target2 = this.dropZoneInventory.find((zone) =>
            DropZone.dropZoneLocationsAreEqual(zone, location2)
         );
         if (target2 === undefined) {
            throw new Error("Could not find drop zone to show");
         }
         const family2 = target2.getFamily();
         if (family === undefined || family2 === undefined) {
            throw new Error("No family");
         }
         const newFamily = {
            founder: family.founder,
            members: [...family.members]
         };
         this.showDropZone(family.founder, true);
         for (const member of family.members.sort(sortFamily)) {
            member.setFamily(newFamily);
            if (member !== family.founder) {
               if (this.activeDropZone === null) {
                  //Failed to activate a zone so far, so activate this one instead
                  this.showDropZone(member, true);
               } else {
                  this.showDropZone(member);
               }
            }
         }
         for (const member of family2.members) {
            member.setFamily(newFamily);
            if (
               member.getLocation().parentCoordinates.length <
               target2.getLocation().parentCoordinates.length
            ) {
               newFamily.members.push(member);
               this.showDropZone(member);
            }
         }
         //Temporarily store the old families
         this.tempFamilies = [family, family2];
         //Remove the old families
         const familyIndex = this.dropZoneFamilies.indexOf(family);
         this.dropZoneFamilies.splice(familyIndex, 1);
         const family2Index = this.dropZoneFamilies.indexOf(family2);
         this.dropZoneFamilies.splice(family2Index, 1);
         //Add the new family
         this.dropZoneFamilies.push(newFamily);
         this.visibleFamily = newFamily;
      } else {
         if (family === undefined) {
            throw new Error("No family");
         }
         this.visibleFamily = family;
         this.showDropZone(family.founder, true);
         for (const member of family.members.sort(sortFamily)) {
            if (member !== family.founder) {
               if (this.activeDropZone === null) {
                  //Failed to activate a zone so far, so activate this one instead
                  this.showDropZone(member, true);
               } else {
                  this.showDropZone(member);
               }
            }
         }
      }
      if (options.activateLowestInsteadOfFounder === true) {
         const lowestMember = [...this.visibleFamily.members]
            .sort(sortFamily)
            .pop();
         if (lowestMember === undefined) {
            throw new Error("Could not get lowest member");
         }
         this.swapActiveDropZone(lowestMember);
      }
   }

   public swapActiveDropZone(newActiveDropZone: DropZone): void {
      if (this.visibleFamily === null) {
         throw new Error("No visible family available for swapping");
      }
      const index = this.visibleFamily.members.findIndex(
         (dropZone) => dropZone === newActiveDropZone
      );
      if (index === -1) {
         throw new Error("failed to swap active drop zone");
      }
      this.setActiveDropZone(newActiveDropZone);
   }

   public assignFamilies(): void {
      const orphanZones = [...this.dropZoneInventory];
      const deepestMembers = orphanZones
         .filter((zone) => {
            const location = zone.getLocation();
            return (
               location.insertIndex === 0 &&
               location.parentCoordinates.length > 0
            );
         })
         .sort((valueA, valueB) => {
            const aCoordinates = valueA.getFullInsertCoordinates();
            const bCoordinates = valueB.getFullInsertCoordinates();
            const length = Math.max(aCoordinates.length, bCoordinates.length);
            for (let index = 0; index < length; index++) {
               if ((aCoordinates[index] ?? -1) > (bCoordinates[index] ?? -1)) {
                  return -1;
               } else if (
                  (aCoordinates[index] ?? -1) < (bCoordinates[index] ?? -1)
               ) {
                  return 1;
               }
            }
            return 0;
         });
      for (const dropZone of deepestMembers) {
         if (!orphanZones.includes(dropZone)) {
            continue;
         }
         const family: DropZoneFamily = {
            founder: dropZone,
            members: []
         };
         dropZone.setFamily(family);
         //See if there are any orphans that belong to this family and claim them.
         const cursor = [...dropZone.getFullInsertCoordinates()];
         while (cursor.length > 0) {
            const familyMemberIndex = orphanZones.findIndex((zone) =>
               arraysAreEqual(zone.getFullInsertCoordinates(), cursor)
            );
            if (familyMemberIndex !== -1) {
               const familyMember = orphanZones.splice(familyMemberIndex, 1)[0];
               family.members.push(familyMember);
               familyMember.setFamily(family);
            }
            cursor.pop();
            cursor[cursor.length - 1]++;
         }
         this.dropZoneFamilies.push(family);
      }
      for (const dropZone of orphanZones.filter(
         (zone) => zone.getFullInsertCoordinates().length === 1
      )) {
         const family: DropZoneFamily = {
            founder: dropZone,
            members: [dropZone]
         };
         dropZone.setFamily(family);
         this.dropZoneFamilies.push(family);
         orphanZones.splice(orphanZones.indexOf(dropZone), 1);
      }
      if (orphanZones.length !== 0) {
         let orphans = "";
         for (const zone of orphanZones) {
            orphans += `${JSON.stringify(zone.getLocation())}, `;
         }
         orphans = orphans.slice(0, orphans.length - 2);
         throw new Error(
            `Some zones were not assigned to a family. The orphan zones have the following locations: ${orphans}`
         );
      }
   }

   private setActiveDropZone(dropZone: DropZone | null): void {
      if (this.activeDropZone !== null) {
         this.activeDropZone.isActive(false);
      }
      this.activeDropZone = dropZone;
      if (
         this.activeDropZone !== null &&
         this.dragStateService.getState() !== "droppable"
      ) {
         this.dragStateService.droppable();
      } else if (
         this.activeDropZone === null &&
         this.dragStateService.getState() === "droppable"
      ) {
         this.dragStateService.notDroppable();
      }
      if (this.activeDropZone !== null) {
         this.activeDropZone.isActive(true);
      }
   }

   private showDropZone(dropZone: DropZone, active = false): boolean {
      if (this.tree === undefined) {
         throw new Error("DropZoneService not initialized");
      }
      if (!this.zoneIsAllowed(dropZone)) {
         //User settings indicate to skip this drop zone
         return false;
      }
      const parent = this.tree.findByCoordinates(
         dropZone.getLocation().parentCoordinates
      );
      if (parent === undefined) {
         throw new Error("Bad family member");
      }
      dropZone.isVisible(true);
      if (active === true) {
         this.setActiveDropZone(dropZone);
      }
      return true;
   }

   private zoneIsAllowed(dropZone: DropZone): boolean {
      if (this.treeOptions === undefined || this.tree === undefined) {
         throw new Error("dropZoneService not initialized");
      }
      const draggedNode = this.dragStateService.getData();
      if (draggedNode === undefined) {
         throw new Error("Can't get dragged node");
      }
      const dropZoneParent = this.tree.findByCoordinates(
         dropZone.getLocation().parentCoordinates
      );
      if (dropZoneParent === undefined) {
         throw new Error("Could not get drop zone parent");
      }
      const dropZoneIndex = dropZone.getLocation().insertIndex;
      if (dropZoneIndex === undefined) {
         throw new Error("Could not get drop zone index");
      }
      if (
         this.treeOptions.allowDrop(
            draggedNode.data,
            dropZoneParent.data as LimbleTreeNode,
            dropZoneIndex
         )
      ) {
         return true;
      }
      return false;
   }
}
