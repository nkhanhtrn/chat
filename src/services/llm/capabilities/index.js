/**
 * Capabilities Index
 *
 * This file registers all available capabilities with the registry.
 * To add a new capability:
 * 1. Create your capability class extending BaseCapability
 * 2. Import it here
 * 3. Register it with the registry
 */

import { registry } from './CapabilityRegistry.js'
import { CodeCapability } from './CodeCapability.js'
import { VisualizationCapability } from './VisualizationCapability.js'
import { TextResponseCapability } from './TextResponseCapability.js'
import { BuildCapability } from './BuildCapability.js'
import { WebSearchCapability } from './WebSearchCapability.js'
import { PlanningCapability } from './PlanningCapability.js'

// Register all capabilities
registry.register(new PlanningCapability())       // Priority 80 (catches complex multi-step requests)
registry.register(new WebSearchCapability())      // Priority 70
registry.register(new VisualizationCapability())  // Priority 60
registry.register(new BuildCapability())          // Priority 55
registry.register(new CodeCapability())           // Priority 50
registry.register(new TextResponseCapability())   // Priority 0 (fallback)

// Export the configured registry
export { registry }

// Export base class and pipe utilities for creating new capabilities
export { BaseCapability, createPipeData } from './BaseCapability.js'

// Export individual capabilities for direct use if needed
export { CodeCapability } from './CodeCapability.js'
export { VisualizationCapability, visualizationHandlers } from './VisualizationCapability.js'
export { TextResponseCapability } from './TextResponseCapability.js'
export { BuildCapability } from './BuildCapability.js'
export { WebSearchCapability } from './WebSearchCapability.js'
export { PlanningCapability } from './PlanningCapability.js'

export default registry
