#engine v8

#include <pjsr/DataType.jsh>
#include "listDir.js"

#feature-id batchLinearFit : WR_PhotoNS > batchLinearFit
#feature-icon batchfast.svg
#feature-info  Does a batch process for directory a linear fit on a target image based on the overlaping area between it and a reference image<br/>\
   <br/>\
   Copyright &copy; 2014 David Ault. All Rights Reserved.\
   <br/><br/>\
   Revisioning and tuning by Wojciech Romowicz &copy; 2026\
   <br/>Added BWMV to Mean function

CoreApplication.ensureMinimumVersion( 1, 9, 5 );

// ----------------------------------------------------------------------------
// dnaLinearFit
//
// Original script by David Ault
// Copyright (C) 2014 David Ault. All Rights Reserved.
//
// Ported to PixInsight V8 JavaScript engine (PI 1.9.5 Lockhart).
// The algorithm, logic, and authorship are entirely David Ault's work.
// V8 migration only — no algorithmic changes.
//
// This script is no longer actively maintained by the original author.
// V8 port performed for compatibility with PixInsight 1.9.5+.
// ----------------------------------------------------------------------------

#define VERSION "0.1"
#define TITLE   "Batched Linear Fit"
var referencePixels = [];
var targetPixels = [];

var imageW,imageH;

function dnaGetLightness( img, i, j, rgbWS )
{
    var sum = 0.0;
    if ( (img.numberOfChannels == 3) && img.isColor )
    {
        var R = rgbWS.Y[0] * img.sample( i, j, 0 );
        var G = rgbWS.Y[1] * img.sample( i, j, 1 );
        var B = rgbWS.Y[2] * img.sample( i, j, 2 );
        sum   = (R + G + B) / (rgbWS.Y[0] + rgbWS.Y[1] + rgbWS.Y[2]);
    }
    else
    {
        for ( var c = 0; c < img.numberOfChannels; ++c )
            sum += img.sample( i, j, c );
        sum /= img.numberOfChannels;
    }
    return sum;
}




function determineLinearFitBWMV( referenceImage, targetImage, channel, rgbWS, clipping)
{

    let referenceMean = 0.0, targetMean = 0.0, cnt = 0;



    let targetIterator = new ImageIterator( targetImage, channel );
    let referenceIterator = referenceImage.numberOfChannels == targetImage.numberOfChannels
        ? new ImageIterator( referenceImage, channel )
        : null;

    for ( let j = 0; j < imageH; ++j )
    {
        for ( let i = 0; i < imageW; ++i )
        {
            let referencePixel = referenceIterator
                ? referenceIterator[j][i]
                : dnaGetLightness( referenceImage, i, j, rgbWS );
            let targetPixel = targetIterator[j][i];
            if ( referencePixel > 0.0 && targetPixel > 0.0 &&
                 referencePixel < clipping && targetPixel < clipping )
            {
                referenceMean += referencePixel;
                targetMean += targetPixel;
                referencePixels[cnt] = referencePixel;
                targetPixels[cnt] = targetPixel;
                ++cnt;
            }
        }
        CoreApplication.processEvents(true);
    }

    referenceMean /= cnt;
    targetMean /= cnt;

    let referenceMedian = Stat.median( referencePixels, 0, cnt );
    let targetMedian = Stat.median( targetPixels, 0, cnt );
    let targetMAD = Stat.MAD(targetPixels, targetMedian, 0, cnt);
    let targetBWMV    = Stat.BWMV(  targetPixels, targetMedian, targetMAD, 9 ,false, 0, cnt);
    let referenceMAD = Stat.MAD(referencePixels, referenceMedian, 0, cnt);
    let referenceBWMV    = Stat.BWMV(  referencePixels,referenceMedian, referenceMAD, 9 ,false, 0, cnt);
    let m = (referenceMean - referenceBWMV) / (targetMean - targetBWMV);
    let b = referenceMean - (m * targetMean);

    if ( m < 0.0 )
    {
        console.writeln( "<b>WARN: calculated slope is negative, inverting</b>:" );
        m = -m;
    }

    targetIterator.free();
    referenceIterator.free();
    referencePixels = [];
    targetPixels = [];

    return { m: m, b: b };
}


function determineLinearFitMeanMedian( referenceImage, targetImage, channel, rgbWS, clipping )
{

    let referenceMean = 0.0, targetMean = 0.0, cnt = 0;

    let targetIterator = new ImageIterator( targetImage, channel );
    let referenceIterator = referenceImage.numberOfChannels == targetImage.numberOfChannels
        ? new ImageIterator( referenceImage, channel )
        : null;

    for ( let j = 0; j < imageH; ++j )
    {
        for ( let i = 0; i < imageW; ++i )
        {
            let referencePixel = referenceIterator
                ? referenceIterator[j][i]
                : dnaGetLightness( referenceImage, i, j, rgbWS );
            let targetPixel = targetIterator[j][i];
            if ( referencePixel > 0.0 && targetPixel > 0.0 &&
                 referencePixel < clipping && targetPixel < clipping )
            {
                referenceMean += referencePixel;
                targetMean += targetPixel;
                referencePixels[cnt] = referencePixel;
                targetPixels[cnt] = targetPixel;
                ++cnt;
            }
        }
        CoreApplication.processEvents(true);
    }

    referenceMean /= cnt;
    targetMean /= cnt;

    let referenceMedian = Stat.median( referencePixels, 0, cnt );
    let targetMedian = Stat.median( targetPixels, 0, cnt );
    let m = (referenceMean - referenceMedian) / (targetMean - targetMedian);
    let b = referenceMean - (m * targetMean);

    if ( m < 0.0 )
    {
        console.writeln( "<b>WARN: calculated slope is negative, inverting</b>:" );
        m = -m;
    }
    targetIterator.free();
    referenceIterator.free();
  //  referencePixels = [];
  //  targetPixels = [];
    return { m: m, b: b };
}

function determineLinearFitLeastSquares( referenceImage, targetImage, channel, rgbWS, clipping, liczMeanT=true )
{

    let referenceMean = 0.0, targetMean = 0.0, cnt = 0;




    let targetIterator = new ImageIterator( targetImage, channel );
    let referenceIterator = referenceImage.numberOfChannels == targetImage.numberOfChannels
        ? new ImageIterator( referenceImage, channel )
        : null;

    for ( let j = 0; j < imageH; ++j )
    {
        for ( let i = 0; i < imageW; ++i )
        {
            let referencePixel = referenceIterator
                ? referenceIterator[j][i]
                : dnaGetLightness( referenceImage, i, j, rgbWS );
            let targetPixel = targetIterator[j][i];
            if ( referencePixel > 0.0 && targetPixel > 0.0 &&
                 referencePixel < clipping && targetPixel < clipping )
            {
                referenceMean += referencePixel;
                targetMean += targetPixel;
                referencePixels[cnt] = referencePixel;
                targetPixels[cnt] = targetPixel;
                ++cnt;
            }
        }
        CoreApplication.processEvents(true);
    }

    referenceMean /= cnt;
    targetMean /= cnt;

    let rise_t = 0.0, run_t = 0.0;
    let rise = 0.0, run = 0.0;
    let midpoint = (cnt - 1) / 2.0;
    for ( let  i = 0; i < cnt; i++ )
    {
         rise += (referencePixels[i] - referenceMean) * (i - midpoint);
         run += Math.pow( referencePixels[i] - referenceMean, 2 );

        rise_t += (targetPixels[i] - targetMean) * (i - midpoint);
        run_t  += Math.pow( targetPixels[i] - targetMean, 2 );
    }

    let mt = rise_t / run_t;
    let mr = rise / run;

    let m = mr / mt;
    let b = referenceMean - m * targetMean;

    targetIterator.free();
    referenceIterator.free();
    referencePixels = [];
    targetPixels = [];
    return { m: m, b: b };
}

function determineLinearFitScalar( referenceImage, targetImage, channel, rgbWS, clipping )
{

    let referenceMean = 0.0, targetMean = 0.0, multAvg = 0.0, cnt = 0;


    let targetIterator = new ImageIterator( targetImage, channel );
    let referenceIterator = referenceImage.numberOfChannels == targetImage.numberOfChannels
        ? new ImageIterator( referenceImage, channel )
        : null;


    let targetPixel;
    let referencePixel;


/*  let ratios = [];
    let refValues = [];
    let tgtValues = [];*/
    for ( let j = 0; j < imageH; ++j )
        {
            for ( let i = 0; i < imageW; ++i )
            {
                referencePixel = (referenceImage.numberOfChannels == targetImage.numberOfChannels)
                ? referenceIterator[j][i]
                : dnaGetLightness( referenceImage, i, j, rgbWS );
                targetPixel=targetIterator[j][i];
                if (targetPixel > 0.0  && referencePixel > 0.0 && referencePixel < clipping && targetPixel < clipping )
                {
                  multAvg       += referencePixel / targetPixel;
                  referenceMean += referencePixel;
                  targetMean    += targetPixel;
                  cnt++;
                }


               // Wewnątrz pętli zamiast dodawać do sumy:
              /* if (targetPixel > 0.0 && referencePixel > 0.0 && referencePixel < clipping && targetPixel < clipping) {
                  ratios.push(referencePixel / targetPixel);
                  refValues.push(referencePixel);
                  tgtValues.push(targetPixel);
               }*/
            }
            CoreApplication.processEvents(true);
    }
    referenceMean /= cnt;
    targetMean    /= cnt;
    multAvg       /= cnt;

    let m = multAvg;
    let b = referenceMean - m * targetMean;

 // Po pętli (pseudokod dla znalezienia mediany z tablicy)
 /*  let m = Math.median(ratios);
   let b = Math.median(refValues) - m * Math.median(tgtValues);
   */

    targetIterator.free();
    referenceIterator.free();

    return { m: m, b: b };


}

function determineLinearFitCombo( referenceImage, targetImage, channel, rgbWS, clipping )
{

    let referenceMean = 0.0, targetMean = 0.0, cnt = 0;




    let targetIterator = new ImageIterator( targetImage, channel );
    let referenceIterator = referenceImage.numberOfChannels == targetImage.numberOfChannels
        ? new ImageIterator( referenceImage, channel )
        : null;

    for ( let j = 0; j < imageH; ++j )
    {
        for ( let i = 0; i < imageW; ++i )
        {
            let referencePixel = referenceIterator
                ? referenceIterator[j][i]
                : dnaGetLightness( referenceImage, i, j, rgbWS );
            let targetPixel = targetIterator[j][i];
            if ( referencePixel > 0.0 && targetPixel > 0.0 &&
                 referencePixel < clipping && targetPixel < clipping )
            {
                referenceMean += referencePixel;
                targetMean += targetPixel;
                referencePixels[cnt] = referencePixel;
                targetPixels[cnt] = targetPixel;
                ++cnt;
            }
        }
        CoreApplication.processEvents(true);
    }

    referenceMean /= cnt;
    targetMean /= cnt;


    let mmLine = determineLinearFitMeanMedian( referenceImage, targetImage, channel, rgbWS, clipping );
    let lsLine = determineLinearFitLeastSquares( referenceImage, targetImage, channel, rgbWS, clipping, false );
    let sLine  = determineLinearFitScalar(   referenceImage, targetImage, channel, rgbWS, clipping );
    let m      = (mmLine.m + lsLine.m + sLine.m) / 3.0;
    let b      = referenceMean - m * targetMean;

    targetIterator.free();
    referenceIterator.free();
    referencePixels = [];
    targetPixels = [];
    return { m: m, b: b};
}

function dnaApplyLinearFit( image, linearData )
{

    let clipHighCnt = 0;
    let clipLowCnt  = 0;

    for ( let c = 0; c < image.numberOfChannels; ++c )
    {
        var m = linearData[c].m;
        var b = linearData[c].b;
        let targetIterator = new ImageIterator( image, c );
        for ( var j = 0; j < imageH; ++j )
        {
            for ( var i = 0; i < imageW; ++i )
            {
                //var value = image.sample( i, j, c );
                var value=targetIterator[j][i];
                if ( value > 0.0 )
                {
                    value = (value * m) + b;
                    if      ( value > 1.0 ) { value = 1.0; clipHighCnt++; }
                    else if ( value < 0.0 ) { value = 0.0; clipLowCnt++;  }
                    image.setSample( value, i, j, c );
                }
            }
            CoreApplication.processEvents(true);
        }
        targetIterator.free();
    }

    return { clc: clipLowCnt, chc: clipHighCnt };
}

function dnaLinearFit( data )
{
    var referenceView = View.viewById(data.referenceView);
    var targetView    = data.targetView;
    var rgbWS         = referenceView.window.rgbWorkingSpace;

    var linearData = new Array( targetView.image.numberOfChannels );
    for ( var c = 0; c < targetView.image.numberOfChannels; ++c )
    {
        switch ( data.method )
        {
        case 0:  linearData[c] = determineLinearFitMeanMedian( referenceView.image, targetView.image, c, rgbWS, data.clipping ); break;
        case 1:  linearData[c] = determineLinearFitBWMV(  referenceView.image, targetView.image, c, rgbWS, data.clipping ); break;
        case 2:  linearData[c] = determineLinearFitLeastSquares( referenceView.image, targetView.image, c, rgbWS, data.clipping ); break;
        case 3:  linearData[c] = determineLinearFitScalar( referenceView.image, targetView.image, c, rgbWS, data.clipping ); break;
        case 4:  linearData[c] = determineLinearFitCombo( referenceView.image, targetView.image, c, rgbWS, data.clipping ); break;
        default: linearData[c] = determineLinearFitMeanMedian( referenceView.image, targetView.image, c, rgbWS, data.clipping ); break;
        }
        console.writeln( "<b>INFO: Channel = ", c, "</b>:" );
        console.writeln( "<b>INFO:     dnaLinearFit m = ", linearData[c].m, "</b>:" );
        console.writeln( "<b>INFO:     dnaLinearFit b = ", linearData[c].b, "</b>:" );
        if (isNaN(linearData[c].m) || isNaN(linearData[c].b)) {
           console.criticalln("Bad linear coefficients!!!");
           return;
        }
    }

    targetView.beginProcess();
    var clippingData = dnaApplyLinearFit( targetView.image, linearData );
    targetView.endProcess();
    console.writeln( "<b>INFO: dnaLinearFit clipped ", clippingData.clc, " low pixels and ", clippingData.chc, " high pixels</b>:" );
}

// ============================================================================
// Form data
// ============================================================================


var  dnaLinearFitData = {
    method: 0,
    clipping: 0.92,
    iterations: 1,
    referenceView: "",
    files: [],

   // stores the current parameters values into the script instance
   save: function() {

      Parameters.set("method", dnaLinearFitData.method);
      Parameters.set("clipping", dnaLinearFitData.clipping);
      Parameters.set("iterations", dnaLinearFitData.iterations);
   },

   // loads the script instance parameters
   load: function () {
      // always check if a vaue with the given key exists since the parameters table
      // can be obsolete or can be modified by the user manually

      if (Parameters.has("method"))
         dnaLinearFitData.method = Parameters.getReal("method");
      if (Parameters.has("clipping"))
         dnaLinearFitData.clipping = Parameters.getReal("clipping");
      if (Parameters.has("iterations"))
         dnaLinearFitData.iterations = Parameters.getReal("iterations");
   }
}




var dnaLinearFitDialog = class extends Dialog
{
    constructor()
    {
      super();


      this.userResizable = true;
        //var halfWidth = Math.floor(MainWindow.width / 2);
      this.setMinWidth(750);


   var parentDialog = this;
   function makeSeparator(symbol) {
      var lbl = new Label(parentDialog);
      lbl.text = symbol;
      //lbl.textAlignment = TextAlign_Center | TextAlign_VertCenter;
      return lbl;
   }

        var labelWidth1       = this.font.width( "Linear Fit Method:" );
        var catalogComboWidth = this.font.width( "Mean / Median" );

        // ---- Help label ----
        this.helpLabel = new Label( this );
        this.helpLabel.frameStyle   = FrameStyle.Box;
        this.helpLabel.margin       = 4;
        this.helpLabel.wordWrapping = true;
        this.helpLabel.useRichText  = true;
        this.helpLabel.text =
            "<b>" + TITLE + " v" + VERSION + "</b> &mdash; " +
            "A script that matches brightness levels between areas of multiple images that should overlap<br/>" +
            "<br/>" +
            "Original script by <b>David Ault</b> &mdash; Copyright &copy; 2014 David Ault. All Rights Reserved.<br/>" +
            "Ported to engine V8 (1.9.4+) by <b>Franklin Marek</b> SetiAstro.<br/>"+
            "Ported, tuned and rewrited to ImageIterators and PixInsight V8 (PI 1.9.5+) by <b>Wojciech Romowicz</b>" +
            "<br/>Batch processing added by <b>Wojciech Romowicz</b>";

        // ---- Reference image ----
        this.referenceImage_Label = new Label( this );
        this.referenceImage_Label.text          = "Reference View:";
        this.referenceImage_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
        this.referenceImage_Label.minWidth      = labelWidth1;


        this.referenceImage_ViewList = new ViewList( this );
        this.referenceImage_ViewList.getAll();
        dnaLinearFitData.referenceView = this.referenceImage_ViewList.currentView.id;
        this.referenceImage_ViewList.minWidth    = 200;
        if (dnaLinearFitData.referenceView !== "")
         var myView = View.viewById(dnaLinearFitData.referenceView);
        this.referenceImage_ViewList.currentView = myView;
        this.referenceImage_ViewList.toolTip     = "<p>Select the reference image</p>";
        this.referenceImage_ViewList.onViewSelected = view => { dnaLinearFitData.referenceView = view.id; };

        this.referenceImage_Sizer = new HorizontalSizer;
        this.referenceImage_Sizer.spacing = 4;
        this.referenceImage_Sizer.add( this.referenceImage_Label );
        this.referenceImage_Sizer.add( this.referenceImage_ViewList, 100 );


         // ---- Input directory ----
this.filesTreeBox = new TreeBox(this);
   this.filesTreeBox.multipleSelection = true;
   this.filesTreeBox.headerVisible = true;
   this.filesTreeBox.numberOfColumns = 1;

   this.filesTreeBox.setHeaderText(0, "File name");
   this.filesTreeBox.setHeaderText(1, "Full path");
   this.filesTreeBox.styleSheet="text-align: left";

   this.filesTreeBox.setColumnWidth(0, 150);
   this.filesTreeBox.setColumnWidth(1, 0);
   this.filesTreeBox.hideColumn(1);
   this.filesTreeBox.minHeight = 250;

   this.addButton = new PushButton(this);
   this.addButton.text = "Add files...";
   this.addButton.styleSheet="text-align: left";

   this.addButton.icon = ":/icons/add.png";

   this.addButton.onClick = function() {
      let ofd = new OpenFileDialog();
      ofd.multipleSelections = true;
      ofd.caption = "Choose files to add";
      ofd.filters = [
         ["Obrazy PixInsight / FITS", "*.xisf", "*.fit", "*.fits", "*.fts"]
      ];

      if (ofd.execute()) {

         let selectedFiles = ofd.fileNames;

         for (let i = 0; i < selectedFiles.length; ++i) {
            let fullPath = ofd.fileNames[i];
            let fileName = File.extractName(fullPath) + File.extractExtension(fullPath);


            // 1. Tworzymy czysty wiersz przypisany do naszej tabeli
            let node = new TreeBoxNode(this.dialog.filesTreeBox);

            // 2. KLUCZOWE W PJSR: Najpierw dodajemy wiersz fizycznie do struktury TreeBox
            this.dialog.filesTreeBox.add(node);

            // 3. DOPIERO TERAZ uzupełniamy komórki danego wiersza tekstem
            node.setText(0, fileName);
            node.setText(1, fullPath);
         }

      }
   };

   this.removeButton = new PushButton(this);
   this.removeButton.styleSheet="text-align: left";
   this.removeButton.text = "Remove selected";
   this.removeButton.icon = ":/icons/delete.png";

  this.removeButton.onClick = function() {

      let selectedNodes = this.dialog.filesTreeBox.selectedNodes;


      if (selectedNodes.length > 0) {

         // Iterujemy OD KOŃCA, aby usunięcie elementu nie psuło indeksowania pozostałych węzłów
         for (let i = 0; i < selectedNodes.length; ++i) {
            this.dialog.filesTreeBox.remove(this.dialog.filesTreeBox.childIndex(selectedNodes[i]));

         }


         this.dialog.filesTreeBox.update(); // Wymuszenie natychmiastowego przerysowania tabeli
      }
   };
   this.removeAllButton = new PushButton(this);
   this.removeAllButton.text = "Remove All";
   this.removeAllButton.styleSheet="text-align: left";
   this.removeAllButton.icon = ":/icons/delete.png";

  this.removeAllButton.onClick = function() {
      this.dialog.filesTreeBox.selectAllNodes();
      let selectedNodes = this.dialog.filesTreeBox.selectedNodes;

      if (selectedNodes.length > 0) {

         // Iterujemy OD KOŃCA, aby usunięcie elementu nie psuło indeksowania pozostałych węzłów
         for (let i = 0; i < selectedNodes.length; ++i) {
            this.dialog.filesTreeBox.remove(this.dialog.filesTreeBox.childIndex(selectedNodes[i]));

         }


         this.dialog.filesTreeBox.update(); // Wymuszenie natychmiastowego przerysowania tabeli
      }
   };


   this.selectAllButton = new PushButton(this);
   this.selectAllButton.text = "Select All";
   this.selectAllButton.styleSheet="text-align: left";
   this.selectAllButton.icon = ":/icons/select-all.png";

  this.selectAllButton.onClick = function() {
      this.dialog.filesTreeBox.selectAllNodes();

         this.dialog.filesTreeBox.update(); // Wymuszenie natychmiastowego przerysowania tabeli

   };

   this.selectNoneButton = new PushButton(this);
   this.selectNoneButton.text = "Deselect All";
   this.selectNoneButton.styleSheet="text-align: left";
   this.selectNoneButton.icon = ":/icons/select-none.png";

  this.selectNoneButton.onClick = function() {
      this.dialog.filesTreeBox.deselectAllNodes();

         this.dialog.filesTreeBox.update(); // Wymuszenie natychmiastowego przerysowania tabeli

   };



   // --- UKŁAD GRAFICZNY (SIZER) ---

   this.actionButtonSizer = new VerticalSizer;
   this.actionButtonSizer.spacing = 6;
   this.actionButtonSizer.add(this.addButton);
   this.actionButtonSizer.add(this.removeButton);
   this.actionButtonSizer.add(this.removeAllButton);
   this.actionButtonSizer.add(this.selectAllButton);
   this.actionButtonSizer.add(this.selectNoneButton);
   this.actionButtonSizer.addStretch();

   this.gridSizer = new HorizontalSizer;
   this.gridSizer.spacing = 8;
   this.gridSizer.add(this.filesTreeBox, 100);
   this.gridSizer.add(this.actionButtonSizer);



        // ---- Method combo ----
        this.method_Label = new Label( this );
        this.method_Label.text          = "LinearFit Method:";
        this.method_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
        this.method_Label.minWidth      = labelWidth1;

        this.method_Combo = new ComboBox( this );
        this.method_Combo.editEnabled = false;
        this.method_Combo.toolTip     = "<p>Method used to fit the image to the reference</p>";
        this.method_Combo.minWidth    = catalogComboWidth;
        this.method_Combo.addItem( "Mean / Median" );
        this.method_Combo.addItem( "BiWeight MidVariance" );
        this.method_Combo.addItem( "Least Squares" );
        this.method_Combo.addItem( "Scalar" );
        this.method_Combo.addItem( "Combo" );
        if ( dnaLinearFitData.method != null ) this.method_Combo.currentItem = dnaLinearFitData.method;
        this.method_Combo.onItemSelected = () => { dnaLinearFitData.method = this.method_Combo.currentItem; };

        // ---- Reject High ----
        this.rejectHigh_Control = new NumericControl( this );
        this.rejectHigh_Control.real           = true;
        this.rejectHigh_Control.label.text     = "Reject High:";
        this.rejectHigh_Control.label.minWidth = labelWidth1;
        this.rejectHigh_Control.toolTip        = "<p>Lower values means more bright pixels will be excluded from the fit.</p>";
        this.rejectHigh_Control.onValueUpdated = value => { dnaLinearFitData.clipping = value; };
        this.rejectHigh_Control.setRange( 0, 1 );
        this.rejectHigh_Control.slider.setRange( 0, 1000 );
        this.rejectHigh_Control.setPrecision( 2 );
        this.rejectHigh_Control.slider.minWidth = 50;
        this.rejectHigh_Control.setValue( dnaLinearFitData.clipping );
        this.rejectHigh_Control.onValueUpdated = value => { dnaLinearFitData.clipping = value; };

         // ---- Number of iterations ----
        this.iteration_Control = new NumericControl( this );
        this.iteration_Control.real           = true;
        this.iteration_Control.label.text     = "Number of iterations:";
        this.iteration_Control.label.minWidth = labelWidth1;
        this.iteration_Control.toolTip        = "<p>Number of iterations for the fit.</p>";
        this.iteration_Control.onValueUpdated = value => { dnaLinearFitData.iterations = value; };
        this.iteration_Control.setRange( 1, 5 );
        this.iteration_Control.slider.setRange( 1, 5 );
        this.iteration_Control.setPrecision( 0 );
        this.iteration_Control.slider.minWidth = 50;
        this.iteration_Control.setValue( dnaLinearFitData.iterations );
        this.iteration_Control.onValueUpdated = value => { dnaLinearFitData.iterations = value; };

        this.sliders_Sizer = new HorizontalSizer;
        this.sliders_Sizer.spacing = 6;
        this.sliders_Sizer.add( this.method_Label );
        this.sliders_Sizer.add( this.method_Combo );
        this.sliders_Sizer.add( this.rejectHigh_Control );
        this.sliders_Sizer.addStretch();
        this.sliders_Sizer.add( this.iteration_Control );







        // ---- OK / Cancel buttons ----
        this.ok_Button = new PushButton( this );
        this.ok_Button.text    = "OK";
        this.ok_Button.cursor  = new Cursor( StdCursor.Checkmark );
        this.ok_Button.onClick = () => {
;
               dnaLinearFitData.save();

        this.ok(); };

        this.cancel_Button = new PushButton( this );
        this.cancel_Button.text    = "Cancel";
        this.cancel_Button.cursor  = new Cursor( StdCursor.Crossmark );
        this.cancel_Button.onClick = () => { this.cancel(); };

        this.buttons_Sizer = new HorizontalSizer;
        this.buttons_Sizer.spacing = 6;
      //  this.buttons_Sizer.add( this.newInstanceButton );
        this.buttons_Sizer.addStretch();
        this.buttons_Sizer.add( this.ok_Button );
        this.buttons_Sizer.add( this.cancel_Button );

        // ---- Main sizer ----
        this.sizer = new VerticalSizer;
        this.sizer.margin  = 6;
        this.sizer.spacing = 25;
        this.sizer.add( this.helpLabel );
        this.sizer.addSpacing( 4 );
        this.sizer.add( this.referenceImage_Sizer );
        this.sizer.add( this.gridSizer );
        this.sizer.add( this.sliders_Sizer );


        this.sizer.add( this.buttons_Sizer );

        this.windowTitle = TITLE;
        this.adjustToContents();
        this.setFixedSize();

    }
};

function batchLinearFit(dane)
{

    // --- KONFIGURACJA ---
    // Ścieżka do panelu referencyjnego (musi być otwarty w PixInsight)
    var referenceViewID = dane.referenceView;

    var refView = View.viewById(dane.referenceView);
    console.warningln(refView.window.filePath);
    imageH=refView.image.height;
    imageW=refView.image.width;

    referencePixels=new Array(imageW*imageH);
    targetPixels=new Array(imageW*imageH);

    let E = new ElapsedTime;


    console.writeln( "<b>INFO: batchDnaLinearFit ", VERSION, "</b>:" );

    var currentWindow;

    for (let i = 0; i < dane.files.length; ++i) {
      console.writeln("Processing " + (i+1) + " of " + dane.files.length + " files");

        currentWindow=ImageWindow.open(dane.files[i]);
      	let currentView;
      	for ( var k in currentWindow )
      	{
    		   // Dostęp do głównego widoku obrazu (mainView)
   		   currentView = currentWindow[k].mainView;
   		   let viewID = currentView.id;

		      console.writeln( "Processing window:" + viewID );
		      dane.targetView = View.viewById(viewID);


    		   for (let iter1=0; iter1 < dane.iterations; ++iter1) dnaLinearFit( dane );
        	   if (currentWindow[k].filePath.length > 0) {
         		// Nadpisuje istniejący plik na dysku w jego oryginalnym formacie (np. .xisf)
         		currentWindow[k].save();
         		console.writeln("-> Plik zapisany pomyślnie: " + currentWindow[k].filePath);
      		} else console.warningln("-> Ostrzeżenie: Widok nie jest powiązany z plikiem na dysku. Nie można zapisać przez .save()");

      		// Force close (true) ignoruje ewentualne komunikaty o niezapisanych zmianach
      		currentWindow[k].forceClose();
      		console.writeln("-> Zamknięto okno: " + viewID);
        }

   }
   targetPixels=[];
   referencePixels=[];
   console.noteln(E.text + "\n\n");

}

// ============================================================================
// Main
// ============================================================================

function main()
{

    console.show();
    Console.abortEnabled=true;

    if ( ImageWindow.activeWindow.isNull )
    {
        console.criticalln("ERROR: there must be at least one image open for this script to function");
        return;
    }
    if (Parameters.isViewTarget) {
        dnaLinearFitData.load();

        dnaLinearFitData.referenceView = Parameters.targetView.id;
        batchLinearFit(dnaLinearFitData);
    }
    else {
      dnaLinearFitData.load();

      let dialog = new dnaLinearFitDialog;
      let ret=0;


      ret=dialog.execute();

      if (!ret) return;


      let count = dialog.filesTreeBox.numberOfChildren;
      let node = [];
      for (let i = 0; i < count; ++i) {
         node = dialog.filesTreeBox.child(i);
         dnaLinearFitData.files.push(node.text(1));
      }

      batchLinearFit(dnaLinearFitData);
   }
   console.writeln( "<b>myDnaLinearFit run has completed.</b>" );

}//MAIN

main();
