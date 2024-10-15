var ARjs = ARjs || {}
var THREEx = THREEx || {}

ARjs.MarkerControls = THREEx.ArMarkerControls = function(context, object3d, parameters){
	var _this = this

	THREEx.ArBaseControls.call(this, object3d)

	this.context = context
	// handle default parameters
	this.parameters = {
		// size of the marker in meter
		size : 1,
		// url of the pattern - IIF type='pattern'
		patternUrl : null,
		// value of the barcode - IIF type='barcode'
		barcodeValue : null,
		// change matrix mode - [modelViewMatrix, cameraTransformMatrix]
		changeMatrixMode : 'modelViewMatrix',
		// minimal confidence in the marke recognition - between [0, 1] - default to 1
		minConfidence: 0.6,

		type: 'roboflow',  // Add Roboflow type
		roboflowModel: null,  // For Roboflow model ID
		roboflowApiKey: null,  // For Roboflow API key
	}

	// sanity check
	var possibleValues = ['pattern', 'barcode', 'unknown', 'roboflow']
	console.assert(possibleValues.indexOf(this.parameters.type) !== -1, 'illegal value', this.parameters.type)
	var possibleValues = ['modelViewMatrix', 'cameraTransformMatrix' ]
	console.assert(possibleValues.indexOf(this.parameters.changeMatrixMode) !== -1, 'illegal value', this.parameters.changeMatrixMode)


        // create the marker Root
	this.object3d = object3d
	this.object3d.matrixAutoUpdate = false;
	this.object3d.visible = false

	//////////////////////////////////////////////////////////////////////////////
	//		setParameters
	//////////////////////////////////////////////////////////////////////////////
	setParameters(parameters)
	function setParameters(parameters){
		if( parameters === undefined )	return
		for( var key in parameters ){
			var newValue = parameters[ key ]

			if( newValue === undefined ){
				console.warn( "THREEx.ArMarkerControls: '" + key + "' parameter is undefined." )
				continue
			}

			var currentValue = _this.parameters[ key ]

			if( currentValue === undefined ){
				console.warn( "THREEx.ArMarkerControls: '" + key + "' is not a property of this material." )
				continue
			}

			_this.parameters[ key ] = newValue
		}
	}

	//////////////////////////////////////////////////////////////////////////////
	//		Code Separator
	//////////////////////////////////////////////////////////////////////////////
	// add this marker to artoolkitsystem
	// TODO rename that .addMarkerControls
	context.addMarker(this)

	if( _this.context.parameters.trackingBackend === 'artoolkit' ){
		this._initArtoolkit()
	}else if( _this.context.parameters.trackingBackend === 'aruco' ){
		// TODO create a ._initAruco
		// put aruco second
		this._arucoPosit = new POS.Posit(this.parameters.size, _this.context.arucoContext.canvas.width)
	}else if( _this.context.parameters.trackingBackend === 'tango' ){
		this._initTango()
	}else console.assert(false)
}

ARjs.MarkerControls.prototype = Object.create( THREEx.ArBaseControls.prototype );
ARjs.MarkerControls.prototype.constructor = THREEx.ArMarkerControls;

ARjs.MarkerControls.prototype.dispose = function(){
	this.context.removeMarker(this)

	// TODO remove the event listener if needed
	// unloadMaker ???
}

//////////////////////////////////////////////////////////////////////////////
//		update controls with new modelViewMatrix
//////////////////////////////////////////////////////////////////////////////

/**
 * When you actually got a new modelViewMatrix, you need to perfom a whole bunch
 * of things. it is done here.
 */
ARjs.MarkerControls.prototype.updateWithModelViewMatrix = function(modelViewMatrix) {
    var markerObject3D = this.object3d;

    // mark object as visible
    markerObject3D.visible = true;

    if (this.context.parameters.trackingBackend === 'artoolkit') {
        // existing logic for artoolkit
        var tmpMatrix = new THREE.Matrix4().copy(this.context._artoolkitProjectionAxisTransformMatrix);
        tmpMatrix.multiply(modelViewMatrix);
        modelViewMatrix.copy(tmpMatrix);
    } else if (this.context.parameters.trackingBackend === 'roboflow') {
        // directly use the modelViewMatrix obtained from Roboflow
    }

    if (this.context.parameters.trackingBackend !== 'tango') {
        // apply the transformation to match the axis orientation
        var markerAxisTransformMatrix = new THREE.Matrix4().makeRotationX(Math.PI / 2);
        modelViewMatrix.multiply(markerAxisTransformMatrix);
    }

    // update the matrix based on changeMatrixMode
    if (this.parameters.changeMatrixMode === 'modelViewMatrix') {
        markerObject3D.matrix.copy(modelViewMatrix);
    } else if (this.parameters.changeMatrixMode === 'cameraTransformMatrix') {
        markerObject3D.matrix.getInverse(modelViewMatrix);
    } else {
        console.assert(false);
    }

    // decompose - the matrix into .position, .quaternion, .scale
    markerObject3D.matrix.decompose(markerObject3D.position, markerObject3D.quaternion, markerObject3D.scale);

    // dispatchEvent
    this.dispatchEvent({ type: 'markerFound' });
};


//////////////////////////////////////////////////////////////////////////////
//		utility functions
//////////////////////////////////////////////////////////////////////////////

/**
 * provide a name for a marker
 * - silly heuristic for now
 * - should be improved
 */
ARjs.MarkerControls.prototype.name = function() {
    var name = '';
    name += this.parameters.type;
    if (this.parameters.type === 'pattern') {
        var url = this.parameters.patternUrl;
        var basename = url.replace(/^.*\//g, '');
        name += ' - ' + basename;
    } else if (this.parameters.type === 'barcode') {
        name += ' - ' + this.parameters.barcodeValue;
    } else if (this.parameters.type === 'roboflow') {
        name += ' - Roboflow Model';
    } else {
        console.assert(false, 'no .name() implemented for this marker controls');
    }
    return name;
};


//////////////////////////////////////////////////////////////////////////////
//		init for Artoolkit
//////////////////////////////////////////////////////////////////////////////
ARjs.MarkerControls.prototype._initArtoolkit = function(){
	var _this = this

	var artoolkitMarkerId = null

	var delayedInitTimerId = setInterval(function(){
		// check if arController is init
		var arController = _this.context.arController
		if( arController === null )	return
		// stop looping if it is init
		clearInterval(delayedInitTimerId)
		delayedInitTimerId = null
		// launch the _postInitArtoolkit
		postInit()
	}, 1000/50)

	return

	function postInit(){
		// check if arController is init
		var arController = _this.context.arController
		console.assert(arController !== null )

		// start tracking this pattern
		if( _this.parameters.type === 'pattern' ){
	                arController.loadMarker(_this.parameters.patternUrl, function(markerId) {
				artoolkitMarkerId = markerId
	                        arController.trackPatternMarkerId(artoolkitMarkerId, _this.parameters.size);
	                });
		}else if( _this.parameters.type === 'barcode' ){
			artoolkitMarkerId = _this.parameters.barcodeValue
			arController.trackBarcodeMarkerId(artoolkitMarkerId, _this.parameters.size);
		}else if( _this.parameters.type === 'unknown' ){
			artoolkitMarkerId = null
		// ROBOFLOW
		}else if(this.parameters.type === 'roboflow'){
			this._initRoboflow();  // New initialization function for Roboflow
		}else{
			console.log(false, 'invalid marker type', _this.parameters.type)
		}

		// listen to the event
		arController.addEventListener('getMarker', function(event){
			if( event.data.type === artoolkit.PATTERN_MARKER && _this.parameters.type === 'pattern' ){
				if( artoolkitMarkerId === null )	return
				if( event.data.marker.idPatt === artoolkitMarkerId ) onMarkerFound(event)
			}else if( event.data.type === artoolkit.BARCODE_MARKER && _this.parameters.type === 'barcode' ){
				// console.log('BARCODE_MARKER idMatrix', event.data.marker.idMatrix, artoolkitMarkerId )
				if( artoolkitMarkerId === null )	return
				if( event.data.marker.idMatrix === artoolkitMarkerId )  onMarkerFound(event)
			}else if( event.data.type === artoolkit.UNKNOWN_MARKER && _this.parameters.type === 'unknown'){
				onMarkerFound(event)
			}
		})

	}

	function onMarkerFound(event){
		// honor his.parameters.minConfidence
		if( event.data.type === artoolkit.PATTERN_MARKER && event.data.marker.cfPatt < _this.parameters.minConfidence )	return
		if( event.data.type === artoolkit.BARCODE_MARKER && event.data.marker.cfMatt < _this.parameters.minConfidence )	return

		var modelViewMatrix = new THREE.Matrix4().fromArray(event.data.matrix)
		_this.updateWithModelViewMatrix(modelViewMatrix)
	}
}

//////////////////////////////////////////////////////////////////////////////
//		aruco specific
//////////////////////////////////////////////////////////////////////////////
ARjs.MarkerControls.prototype._initAruco = function(){
	this._arucoPosit = new POS.Posit(this.parameters.size, _this.context.arucoContext.canvas.width)
}

//////////////////////////////////////////////////////////////////////////////
//		init for Artoolkit
//////////////////////////////////////////////////////////////////////////////
ARjs.MarkerControls.prototype._initTango = function(){
	var _this = this
	console.log('init tango ArMarkerControls')
}

//////////////////////////////////////////////////////////////////////////////
//		init for Roboflow
//////////////////////////////////////////////////////////////////////////////
ARjs.MarkerControls.prototype._initRoboflow = function() {
    const apiKey = this.parameters.roboflowApiKey;
    const model = this.parameters.roboflowModel;

    if (!apiKey || !model) {
        console.error('Missing Roboflow API key or model.');
        return;
    }

    // Attach Roboflow detection to the video feed in the context
    this.context.onVideoFrame((frame) => {
        detectMarker(frame);
    });

    // Example API request to detect markers
    async function detectMarker(imageData) {
        try {
            const response = await fetch(`https://detect.roboflow.com/${model}?api_key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageData }),
            });

            const result = await response.json();
            _this.processRoboflowResults(result.predictions);
        } catch (error) {
            console.error('Roboflow detection error:', error);
        }
    }
};

//////////////////////////////////////////////////////////////////////////////
//		process for Roboflow
//////////////////////////////////////////////////////////////////////////////

ARjs.MarkerControls.prototype.processRoboflowResults = function(predictions) {
    predictions.forEach(prediction => {
        if (prediction.confidence >= this.parameters.minConfidence) {
            const modelViewMatrix = new THREE.Matrix4().fromArray(prediction.bbox);
            this.updateWithModelViewMatrix(modelViewMatrix);
        }
    });
};


