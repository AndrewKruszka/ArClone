var THREEx = THREEx || {}

THREEx.ArBaseControls = function(object3d){
    this.id = THREEx.ArBaseControls.id++

    this.object3d = object3d
    this.object3d.matrixAutoUpdate = false
    this.object3d.visible = false

    // Events to honor
    // this.dispatchEvent({ type: 'becameVisible' })
    // this.dispatchEvent({ type: 'markerVisible' }) // replace markerFound
    // this.dispatchEvent({ type: 'becameUnVisible' })
}

THREEx.ArBaseControls.id = 0

Object.assign(THREEx.ArBaseControls.prototype, THREE.EventDispatcher.prototype)

//////////////////////////////////////////////////////////////////////////////
//      Functions
//////////////////////////////////////////////////////////////////////////////

/**
 * Function to handle marker updates, to be implemented by subclasses.
 */
THREEx.ArBaseControls.prototype.update = function(){
    console.assert(false, 'you need to implement your own update')
}

/**
 * Function to return the name of the control, to be implemented by subclasses.
 */
THREEx.ArBaseControls.prototype.name = function(){
    console.assert(false, 'you need to implement your own .name()')
    return 'Not yet implemented - name()'
}

/**
 * Custom implementation for Roboflow marker detection.
 * @param {Object} result - Results from Roboflow API, including marker bounding box.
 */
THREEx.ArBaseControls.prototype.updateWithRoboflow = function(result){
    var object3d = this.object3d

    // Mark the object as visible
    object3d.visible = true

    // Update object's matrix using the bounding box data returned from Roboflow
    var modelViewMatrix = new THREE.Matrix4().fromArray(result.bbox)

    object3d.matrix.copy(modelViewMatrix)
    object3d.matrix.decompose(object3d.position, object3d.quaternion, object3d.scale)

    // Trigger a custom event for marker found
    this.dispatchEvent({ type: 'markerFound' })
}

/**
 * Provide a name for the marker. Customize this for Roboflow markers if needed.
 */
THREEx.ArBaseControls.prototype.name = function(){
    return 'RoboflowMarker-' + this.id
}
