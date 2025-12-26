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

// Register all capabilities
registry.register(new VisualizationCapability())  // Priority 60
registry.register(new CodeCapability())           // Priority 50
registry.register(new TextResponseCapability())   // Priority 0 (fallback)

// Export the configured registry
export { registry }

// Export base class for creating new capabilities
export { BaseCapability } from './BaseCapability.js'

// Export individual capabilities for direct use if needed
export { CodeCapability } from './CodeCapability.js'
export { VisualizationCapability, visualizationHandlers } from './VisualizationCapability.js'
export { TextResponseCapability } from './TextResponseCapability.js'

export default registry
