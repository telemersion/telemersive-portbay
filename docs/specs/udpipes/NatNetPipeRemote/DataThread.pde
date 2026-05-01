public class DataThread extends Thread {
  boolean isRunning;
  byte[] buf = new byte[packageSize_data];

  byte[] firstAnswer;

  public void kill() {
    isRunning = false;
  }

  public void run() {
    System.out.println("DataThread is running...");
    isRunning = true;
    DatagramPacket NatNetDataPacket = new DatagramPacket(buf, buf.length);
    while (isRunning) {
      try {
        while (true) {   
          telematicServer_Data.receive(NatNetDataPacket);
          byte[] newArray = trimmByteArray(NatNetDataPacket);
          sizeDataMsg = newArray.length;
          
          if(verbose_data){  
            println();
            print("data package: Server ("+NatNetDataPacket.getPort()+") to NatNetClient (" + telematicPort_Data + ")");
            printOutByteArray(newArray);  
          }
          if (firstAnswer == null || newArray[0] == 3 || newArray[0] == 4) {
            firstAnswer = NatNetDataPacket.getData();
          }
          
          DatagramPacket proxyPacket = new DatagramPacket(newArray, newArray.length, motiveGroup, motivePort_Data);
          motiveClient_Data.send(proxyPacket);
          
          countDataMsgs++;
        }
      } 
      catch(Exception e) {
        ;
      }
    }
  }
}
