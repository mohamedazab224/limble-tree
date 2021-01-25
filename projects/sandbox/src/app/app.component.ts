import { Component, DoCheck, ViewChild } from "@angular/core";
import {
   LimbleTreeRootComponent,
   LimbleTreeData,
   LimbleTreeNode
} from "projects/limble-tree/src/public-api";
import { TreeItemAltComponent } from "./tree-item-alt/tree-item-alt.component";
import { TreeItemComponent } from "./tree-item/tree-item.component";

@Component({
   selector: "app-root",
   templateUrl: "./app.component.html",
   styleUrls: ["./app.component.scss"]
})
export class AppComponent implements DoCheck {
   @ViewChild("tree") limbleTree: LimbleTreeRootComponent | undefined;

   public limbleTreeData: LimbleTreeData = {
      nodes: [
         {
            data: { value1: "this thing" },
            nodes: [
               { data: { value1: "other thing" } },
               {
                  data: {
                     value1:
                        "another thing. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."
                  },
                  nodes: [
                     { data: { value1: "his thing" } },
                     { data: { value1: "her thing" } }
                  ]
               }
            ]
         },
         {
            data: {
               value1:
                  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
            }
         },
         {
            component: {
               class: TreeItemAltComponent,
               bindings: { bgColor: "#0070cc" }
            },
            data: { value1: "these things" },
            nodes: [{ data: { value1: "a thing" } }]
         },
         {
            component: {
               class: TreeItemAltComponent,
               bindings: { bgColor: "#00a329" }
            },
            data: { value1: "those things" }
         }
      ],
      options: {
         defaultComponent: { class: TreeItemComponent },
         indent: 60,
         allowNesting: true
      }
   };

   public limbleTreeDataString: string;

   constructor() {
      this.limbleTreeDataString = JSON.stringify(this.limbleTreeData, null, 2);
   }

   ngDoCheck() {
      this.limbleTreeDataString = JSON.stringify(this.limbleTreeData, null, 2);
   }

   public addNode(node: LimbleTreeNode) {
      this.limbleTreeData.nodes.push(node);
      this.reRenderTree();
   }

   public treeChangeHandler() {
      console.log("changed!");
   }

   private reRenderTree() {
      if (this.limbleTree !== undefined) {
         this.limbleTree.reRender();
      }
   }
}
